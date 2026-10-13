import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, requireRole } from "@/lib/auth/server";
import { bitcartStores } from "@/lib/bitcart/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(`stores:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"}`, 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  try {
    const actor = await requireRole(request, "admin", "operator");
    const stores = await bitcartStores(actor.bitcartAccessToken);
    recordAuditEvent({ actorId: actor.id, action: "stores.list", outcome: "allowed", role: actor.role });
    return NextResponse.json({ stores });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      recordAuditEvent({ action: "stores.list", outcome: "denied" });
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    recordAuditEvent({ action: "stores.list", outcome: "failed" });
    return NextResponse.json({ error: "integration_unavailable" }, { status: 503 });
  }
}
