# Security baseline

- The Bitcart password is posted only to the Ágora BFF. The returned Bitcart bearer token is encrypted inside the `HttpOnly` Agora session and is extracted server-side only.
- The BFF is deny-by-default: no privileged Bitcart endpoint is enabled without an Agora session and a role check.
- Operational controls include process-local request-rate limits, same-origin CSRF assertion on invoice creation, and redacted structured audit events. The single-container test deployment is not horizontally scaled; a shared rate limiter and persistent audit sink are required before horizontal production deployment.
- Bitcart tokens request only `invoice_management` and `store_management`; wallet management is not requested by the MVP.
- Wallet provisioning belongs to PS-36. The Admin must never collect, retain, log, or return a seed phrase or private key.
- Payment links, wallet responses, and webhooks must be mapped to explicit domain DTOs before becoming API responses. Raw Bitcart proxying is forbidden.
- Permanent public checkout URLs use 256-bit random URL-safe tokens; only a SHA-256 token digest is indexed. Stored Bitcart credentials are encrypted with AES-256-GCM under a key derived from `NEXTAUTH_SECRET` and are never returned to a client. Protect and back up both the SQLite volume and its secret.
- Public link reads are side-effect-free. An explicit same-origin POST is atomically reserved in SQLite before server-to-server invoice creation; repeat clicks while processing/after ambiguous failure do not issue a second invoice. The browser is redirected only after Bitcart returns and validates an invoice ID. A confirmed existing invoice reuses its `/admin/i/{id}` checkout URL.
- Public pay endpoints have process-local per-IP and per-link rate limits. As with existing controls, shared enforcement is required before horizontal scaling.
- SQLite is single-container persistence, not a distributed database. Volume loss loses links and the local duplicate/uncertain-outcome guard; restoring an older backup can likewise roll state back. Reconcile payment state against Bitcart after disaster recovery before accepting retries.
- A process crash after invoice creation but before SQLite records the invoice can leave the link in `processing`. This intentionally blocks another invoice; an operator must reconcile Bitcart before any manual recovery.
- Link records have no application expiry, but issuing a later invoice still depends on the stored Bitcart bearer remaining accepted. Revoking it at Bitcart disables payment on that link; no Bitcart credential refresh flow is available in this scope.
- Payouts and refunds are out of scope for the first milestone.
