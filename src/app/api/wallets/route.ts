import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, requireRole } from "@/lib/auth/server";
import { bitcartRequest } from "@/lib/bitcart/server";
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
    const response = await bitcartRequest(
      actor.bitcartAccessToken,
      "/api/wallets?limit=100",
    );
    const wallets: unknown = await response.json();

    // The wallet domain is introduced in PS-36. This route deliberately
    // exposes no raw integration response before that sanitiser exists.
    recordAuditEvent({
      actorId: actor.id,
      action: "wallets.list",
      outcome: "allowed",
      role: actor.role,
    });
    return NextResponse.json({ wallets });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      recordAuditEvent({ action: "wallets.list", outcome: "denied" });
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    recordAuditEvent({ action: "wallets.list", outcome: "failed" });
    return NextResponse.json({ error: "integration_unavailable" }, { status: 503 });
  }
}
