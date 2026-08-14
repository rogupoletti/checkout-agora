import { NextResponse } from "next/server";
import { bitcartReadiness } from "@/lib/bitcart/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const readiness = await bitcartReadiness();
    return NextResponse.json(
      { status: readiness.ok ? "ok" : "degraded", bitcart: readiness.status },
      { status: readiness.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
