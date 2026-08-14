import "server-only";

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { AgoraActor, AgoraRole } from "@/lib/auth/types";

export type { AgoraActor, AgoraRole } from "@/lib/auth/types";

export class AuthenticationError extends Error {}

/**
 * Bitcart access tokens are encrypted inside the HttpOnly session cookie by
 * NextAuth and are extracted server-side only. The browser sees only the
 * ordinary opaque session cookie, never the raw Bitcart bearer token.
 */
export async function requireRole(
  request: NextRequest,
  ...roles: AgoraRole[]
): Promise<AgoraActor> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (
    !token?.sub ||
    !token.email ||
    !token.role ||
    !token.bitcartAccessToken ||
    !roles.includes(token.role)
  ) {
    throw new AuthenticationError("An authorized Agora session is required");
  }

  return {
    id: token.sub,
    email: token.email,
    role: token.role,
    bitcartAccessToken: token.bitcartAccessToken,
  };
}
