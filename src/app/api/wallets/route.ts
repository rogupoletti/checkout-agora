import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, requireRole } from "@/lib/auth/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(
    `wallets:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"}`,
    60,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const actor = await requireRole(request, "admin", "auditor");
    recordAuditEvent({
      actorId: actor.id,
      action: "wallets.list",
      outcome: "denied",
      role: actor.role,
    });
    // Wallets are out of scope for PS-51. Never proxy Bitcart wallet payloads
    // until PS-36 provides an explicit, reviewed domain DTO.
    return NextResponse.json({ error: "not_available" }, { status: 501 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      recordAuditEvent({ action: "wallets.list", outcome: "denied" });
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    recordAuditEvent({ action: "wallets.list", outcome: "failed" });
    return NextResponse.json({ error: "integration_unavailable" }, { status: 503 });
  }
}
