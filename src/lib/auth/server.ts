import "server-only";

export type AgoraRole = "admin" | "operator" | "auditor";

export class AuthenticationError extends Error {}

/**
 * The BFF starts closed. Native Bitcart identity/session integration is added
 * before any privileged route is enabled; a browser must never hold a Bitcart
 * bearer token as a substitute for an Agora session.
 */
export async function requireRole(...roles: AgoraRole[]): Promise<never> {
  void roles;
  throw new AuthenticationError("An authenticated Agora session is required");
}
