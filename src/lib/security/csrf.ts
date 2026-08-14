import "server-only";

import type { NextRequest } from "next/server";

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host || new URL(origin).host !== host) {
    throw new Error("Cross-site mutation rejected");
  }
}
