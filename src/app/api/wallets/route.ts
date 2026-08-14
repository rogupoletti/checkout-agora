import { NextResponse } from "next/server";
import { AuthenticationError, requireRole } from "@/lib/auth/server";
import { bitcartRequest } from "@/lib/bitcart/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("admin", "auditor");
    const response = await bitcartRequest("/api/wallets?limit=100");
    const wallets: unknown = await response.json();

    // The wallet domain is introduced in PS-36. This route deliberately
    // exposes no raw integration response before that sanitiser exists.
    return NextResponse.json({ wallets });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    return NextResponse.json({ error: "integration_unavailable" }, { status: 503 });
  }
}
