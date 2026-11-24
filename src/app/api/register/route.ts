import { NextRequest, NextResponse } from "next/server";
import { BitcartHttpError, registerBitcartUser } from "@/lib/bitcart/server";
import { recordAuditEvent } from "@/lib/security/audit";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Cloudflare overwrites this value at the edge. Do not trust caller-controlled X-Forwarded-For.
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  const rate = checkRateLimit(`register:${address}`, 4, 60 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    assertSameOrigin(request);
  } catch {
    recordAuditEvent({ action: "accounts.register", outcome: "denied" });
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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const captchaCode = typeof input.captchaCode === "string" ? input.captchaCode.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      password.length < 12 || password.length > 256 || captchaCode.length > 4096) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const result = await registerBitcartUser({ email, password, ...(captchaCode ? { captchaCode } : {}) });
    recordAuditEvent({ action: "accounts.register", outcome: "allowed" });
    // Bitcart may return a full-control token when email verification is off.
    // The adapter deliberately discards it; the user signs in for a scoped token.
    return NextResponse.json({ status: "created", verified: result.verified }, { status: 201 });
  } catch (error) {
    const upstreamStatus = error instanceof BitcartHttpError ? error.status : undefined;
    recordAuditEvent({
      action: "accounts.register",
      outcome: "failed",
      ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
      ...(upstreamStatus !== undefined
        ? { failureCode: upstreamStatus >= 500 ? "upstream_server_error" as const : "upstream_rejected" as const }
        : {}),
    });

    return NextResponse.json(
      { error: "registration_unavailable" },
      { status: upstreamStatus === 422 ? 409 : 503 },
    );
  }
}
