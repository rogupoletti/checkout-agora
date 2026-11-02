# Security baseline

- The Bitcart password is posted only to the Ágora BFF. The returned Bitcart bearer token is encrypted inside the `HttpOnly` Agora session and is extracted server-side only.
- The BFF is deny-by-default: no privileged Bitcart endpoint is enabled without an Agora session and a role check.
- Operational controls include process-local request-rate limits, same-origin CSRF assertion on invoice creation, and redacted structured audit events. The single-container test deployment is not horizontally scaled; a shared rate limiter and persistent audit sink are required before horizontal production deployment.
- Bitcart tokens request only `invoice_management` and `store_management`; wallet management is not requested by the MVP.
- Wallet provisioning belongs to PS-36. The Admin must never collect, retain, log, or return a seed phrase or private key.
- Payment links, wallet responses, and webhooks must be mapped to explicit domain DTOs before becoming API responses. Raw Bitcart proxying is forbidden.
- Payouts and refunds are out of scope for the first milestone.
