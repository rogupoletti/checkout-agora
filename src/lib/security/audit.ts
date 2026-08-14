import "server-only";

type AuditEvent = {
  actorId?: string;
  action: string;
  outcome: "allowed" | "denied" | "failed";
  role?: string;
};

/**
 * The first deployment writes redacted structured events. A persistent sink is
 * selected before production; this boundary prevents credentials, payment
 * payloads and wallet metadata from ever being logged accidentally.
 */
export function recordAuditEvent(event: AuditEvent) {
  console.info(
    JSON.stringify({
      type: "agora.audit",
      at: new Date().toISOString(),
      ...event,
    }),
  );
}
