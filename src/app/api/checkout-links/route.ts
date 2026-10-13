import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, requireRole } from "@/lib/auth/server";
import { bitcartStores } from "@/lib/bitcart/server";
import { createCheckoutLink } from "@/lib/checkout-links";
import { recordAuditEvent } from "@/lib/security/audit";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(`checkout-links:${address}`, 10, 60_000).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let actor;
  try {
    actor = await requireRole(request, "admin", "operator");
  } catch (error) {
    if (error instanceof AuthenticationError) {
      recordAuditEvent({ action: "checkout_links.create", outcome: "denied" });
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }

  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "invalid_input" }, { status: 415 });
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const input = body as Record<string, unknown>;
    const price = typeof input.price === "string" ? input.price.trim() : "";
    const storeId = typeof input.storeId === "string" ? input.storeId : "";
    const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
    const orderId = typeof input.orderId === "string" ? input.orderId.trim() : "";
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,8})?$/.test(price) || Number(price) <= 0 ||
      !/^[A-Z0-9]{3,10}$/.test(currency) || !storeId || storeId.length > 128 ||
      orderId.length > 128 || notes.length > 500) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const stores = await bitcartStores(actor.bitcartAccessToken);
    const store = stores.find((candidate) => candidate.id === storeId);
    if (!store) return NextResponse.json({ error: "invalid_store" }, { status: 400 });
    const token = await createCheckoutLink({
      price, storeId, storeName: store.name, currency, orderId, notes,
      bitcartAccessToken: actor.bitcartAccessToken,
      creatorId: actor.id,
    });
    recordAuditEvent({ actorId: actor.id, action: "checkout_links.create", outcome: "allowed", role: actor.role });
    return NextResponse.json({ url: new URL(`/p/${token}`, request.url).toString() }, { status: 201 });
  } catch {
    recordAuditEvent({ actorId: actor.id, action: "checkout_links.create", outcome: "failed", role: actor.role });
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }
}
