import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const createBitcartInvoiceResult = vi.fn(async () => ({
  id: "fake-invoice-1",
  checkoutUrl: "https://bitcart.invalid/admin/i/fake-invoice-1",
}));

vi.mock("@/lib/bitcart/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/bitcart/server")>(),
  createBitcartInvoiceResult,
}));

let testDirectory: string;
let service: typeof import("@/lib/checkout-links");
let publicCheckoutRoute: typeof import("@/app/api/public-checkout/[token]/route");

beforeAll(async () => {
  testDirectory = await mkdtemp(join(tmpdir(), "agora-checkout-links-"));
  process.env.AGORA_DATA_DIR = testDirectory;
  process.env.NEXTAUTH_SECRET = "test-only-secret-with-at-least-thirty-two-bytes";
  process.env.BITCART_API_URL = "https://bitcart.invalid";
  service = await import("@/lib/checkout-links");
  publicCheckoutRoute = await import("@/app/api/public-checkout/[token]/route");
});

afterAll(async () => {
  await service.closeCheckoutLinkDatabase();
  await rm(testDirectory, { recursive: true, force: true });
  delete process.env.AGORA_DATA_DIR;
  delete process.env.BITCART_API_URL;
});

function makePostRequest(token: string) {
  return new NextRequest(`http://agora.test/api/public-checkout/${token}`, {
    method: "POST",
    headers: { origin: "http://agora.test", host: "agora.test", "x-forwarded-for": "198.51.100.27" },
  });
}

describe("permanent checkout links", () => {
  it("public GET is read-only and does not create an invoice", async () => {
    const token = await service.createCheckoutLink({
      price: "19.90", storeId: "store-1", storeName: "Loja de teste", currency: "BRL",
      orderId: "pedido-1", notes: "fake checkout", bitcartAccessToken: "fake-bitcart-token", creatorId: "operator-1",
    });
    const request = new NextRequest(`http://agora.test/api/public-checkout/${token}`);
    const response = await publicCheckoutRoute.GET(request, { params: Promise.resolve({ token }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ checkout: { price: "19.90", currency: "BRL", status: "ready" } });
    expect(createBitcartInvoiceResult).not.toHaveBeenCalled();
    expect(await service.getPublicCheckoutLink(token)).not.toHaveProperty("bitcartAccessToken");
  });

  it("creates one invoice only on explicit POST and redirects to its Bitcart checkout", async () => {
    const token = await service.createCheckoutLink({
      price: "5", storeId: "fake-store", storeName: "Fake", currency: "USD",
      orderId: "", notes: "", bitcartAccessToken: "fake-token-never-returned", creatorId: "operator-2",
    });

    expect(createBitcartInvoiceResult).not.toHaveBeenCalled();
    const firstResponse = await publicCheckoutRoute.POST(makePostRequest(token), { params: Promise.resolve({ token }) });
    const repeatedResponse = await publicCheckoutRoute.POST(makePostRequest(token), { params: Promise.resolve({ token }) });

    expect(firstResponse.status).toBe(303);
    expect(firstResponse.headers.get("location")).toBe("https://bitcart.invalid/admin/i/fake-invoice-1");
    expect(repeatedResponse.status).toBe(303);
    expect(repeatedResponse.headers.get("location")).toBe("https://bitcart.invalid/admin/i/fake-invoice-1");
    expect(createBitcartInvoiceResult).toHaveBeenCalledTimes(1);
    expect(createBitcartInvoiceResult).toHaveBeenCalledWith("fake-token-never-returned", {
      price: "5", store_id: "fake-store", currency: "USD",
    });
    expect(await service.getPublicCheckoutLink(token)).toMatchObject({ status: "invoice_created" });
  });
});
