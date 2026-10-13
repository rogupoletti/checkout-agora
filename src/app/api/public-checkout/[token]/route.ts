import { NextRequest, NextResponse } from "next/server";
import { BitcartHttpError, createBitcartInvoiceResult } from "@/lib/bitcart/server";
import { getPublicCheckoutLink, payPublicCheckoutLink } from "@/lib/checkout-links";
import { recordAuditEvent } from "@/lib/security/audit";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const checkout = await getPublicCheckoutLink(token);
  if (!checkout) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ checkout }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const address = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const addressRate = checkRateLimit(`public-checkout:ip:${address}`, 20, 60_000);
  const linkRate = checkRateLimit(`public-checkout:token:${token}`, 6, 60_000);
  if (!addressRate.allowed || !linkRate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(Math.max(addressRate.retryAfterSeconds, linkRate.retryAfterSeconds)) } });
  }
  try {
    assertSameOrigin(request);
  } catch {
    recordAuditEvent({ action: "checkout_links.pay", outcome: "denied" });
    return NextResponse.json({ error: "cross_site_request" }, { status: 403 });
  }

  try {
    const result = await payPublicCheckoutLink(token, async ({ bitcartAccessToken, price, storeId, currency, orderId, notes }) => {
      return createBitcartInvoiceResult(bitcartAccessToken, {
        price, store_id: storeId, currency,
        ...(orderId ? { order_id: orderId } : {}),
        ...(notes ? { notes } : {}),
      });
    });
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (result.kind === "conflict") return NextResponse.json({ error: "payment_in_progress_or_unavailable" }, { status: 409 });
    recordAuditEvent({ action: "checkout_links.pay", outcome: "allowed" });
    return NextResponse.redirect(result.checkoutUrl, 303);
  } catch (error) {
    const status = error instanceof BitcartHttpError ? error.status : undefined;
    recordAuditEvent({ action: "checkout_links.pay", outcome: "failed", ...(status !== undefined ? { upstreamStatus: status } : {}) });
    const outcomeUnknown = error instanceof Error && (error.name === "TimeoutError" || status === undefined || status >= 500);
    return NextResponse.json({ error: outcomeUnknown ? "outcome_unknown" : "payment_failed" }, { status: outcomeUnknown ? 504 : 503 });
  }
}
