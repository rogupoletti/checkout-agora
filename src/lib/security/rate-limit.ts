import "server-only";

type RateLimit = { allowed: boolean; retryAfterSeconds: number };

const windows = new Map<string, { count: number; resetAt: number }>();

/**
 * Process-local safety floor. Production must replace this with a shared
 * limiter before horizontal scaling, while preserving this small interface.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimit {
  const now = Date.now();
  const existing = windows.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : existing;

  bucket.count += 1;
  windows.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}
