# Security baseline

- Bitcart credentials are read only by `src/lib/bitcart/server.ts`, which is marked `server-only`.
- The BFF is deny-by-default: no privileged Bitcart endpoint is enabled without an Agora session and a role check.
- Wallet provisioning belongs to PS-36. The Admin must never collect, retain, log, or return a seed phrase or private key.
- Payment links, wallet responses, and webhooks must be mapped to explicit domain DTOs before becoming API responses. Raw Bitcart proxying is forbidden.
- Payouts and refunds are out of scope for the first milestone.
