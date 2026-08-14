# Security baseline

- The Bitcart password is posted only to the Ágora BFF. The returned Bitcart bearer token is encrypted inside the `HttpOnly` Agora session and is extracted server-side only.
- The BFF is deny-by-default: no privileged Bitcart endpoint is enabled without an Agora session and a role check.
- The first operational controls include request-rate limits, same-origin CSRF assertion for future mutations and redacted structured audit events. A shared rate limiter and persistent audit sink are required before horizontal production deployment.
- Wallet provisioning belongs to PS-36. The Admin must never collect, retain, log, or return a seed phrase or private key.
- Payment links, wallet responses, and webhooks must be mapped to explicit domain DTOs before becoming API responses. Raw Bitcart proxying is forbidden.
- Payouts and refunds are out of scope for the first milestone.
