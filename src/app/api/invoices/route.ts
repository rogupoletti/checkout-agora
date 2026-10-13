import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, requireRole } from "@/lib/auth/server";
import { BitcartHttpError, bitcartStores, createBitcartInvoice } from "@/lib/bitcart/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rate = checkRateLimit(`invoices:${address}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  let actor;
  let invoiceRequestStarted = false;
  try {
    actor = await requireRole(request, "admin", "operator");
  } catch (error) {
    if (error instanceof AuthenticationError) {
      recordAuditEvent({ action: "invoices.create", outcome: "denied" });
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    recordAuditEvent({ action: "invoices.create", outcome: "failed" });
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }

  try {
    try {
      assertSameOrigin(request);
    } catch {
      recordAuditEvent({ actorId: actor.id, action: "invoices.create", outcome: "denied", role: actor.role });
      return NextResponse.json({ error: "cross_site_request" }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "invalid_input" }, { status: 415 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
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

    // Bind the chosen store to the authenticated Bitcart identity; never trust an arbitrary client-supplied store ID.
    const stores = await bitcartStores(actor.bitcartAccessToken);
    if (!stores.some((store) => store.id === storeId)) {
      return NextResponse.json({ error: "invalid_store" }, { status: 400 });
    }

    invoiceRequestStarted = true;
    const response = await createBitcartInvoice(actor.bitcartAccessToken, {
      price, store_id: storeId, currency,
      ...(orderId ? { order_id: orderId } : {}),
      ...(notes ? { notes } : {}),
    });
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || typeof (result as { id?: unknown }).id !== "string") {
      throw new Error("Unexpected Bitcart invoice response");
    }
    const invoice = result as Record<string, unknown>;
    const id = invoice.id as string;
    const base = new URL(process.env.BITCART_API_URL ?? "https://bitcart.docktools.com.br");
    // Bitcart's checkout page is served from the same trusted host as its API.
    const checkoutUrl = new URL(`/i/${encodeURIComponent(id)}`, base).toString();
    recordAuditEvent({ actorId: actor.id, action: "invoices.create", outcome: "allowed", role: actor.role });
    return NextResponse.json({
      invoice: {
        id,
        checkoutUrl,
        price: typeof invoice.price === "string" || typeof invoice.price === "number" ? String(invoice.price) : price,
        currency: typeof invoice.currency === "string" ? invoice.currency : currency,
        status: typeof invoice.status === "string" ? invoice.status : "created",
      },
    }, { status: 201 });
  } catch (error) {
    const upstreamStatus = error instanceof BitcartHttpError ? error.status : undefined;
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    const outcomeUnknown = invoiceRequestStarted &&
      (timedOut || upstreamStatus === undefined || upstreamStatus >= 500);
    recordAuditEvent({
      actorId: actor.id,
      action: "invoices.create",
      outcome: "failed",
      role: actor.role,
      ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
      ...(outcomeUnknown
        ? { failureCode: "creation_outcome_unknown" as const }
        : upstreamStatus !== undefined
          ? { failureCode: upstreamStatus >= 500 ? "upstream_server_error" as const : "upstream_rejected" as const }
          : {}),
    });
    return NextResponse.json(
      { error: outcomeUnknown ? "outcome_unknown" : "integration_unavailable" },
      { status: outcomeUnknown ? 504 : 503 },
    );
  }
}
