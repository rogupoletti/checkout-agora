# Security baseline

- The Bitcart password is posted only to the Ágora BFF. The returned Bitcart bearer token is encrypted inside the `HttpOnly` Agora session and is extracted server-side only.
- The BFF is deny-by-default: only public registration is unauthenticated. Wallet/store provisioning and invoice operations require an Agora session and role check.
- Operational controls include process-local request-rate limits, same-origin CSRF assertion on invoice creation, and redacted structured audit events. The single-container test deployment is not horizontally scaled; a shared rate limiter and persistent audit sink are required before horizontal production deployment.
- Bitcart tokens request `invoice_management`, `store_management`, and `wallet_management` with strict scoped permissions.
- Public signup creates a native Bitcart account. The optional full-control token returned by Bitcart is discarded; users authenticate again to receive a scoped token.
- BTC/BCH recovery phrases are generated and used only in browser memory to derive an account xpub; only the xpub is sent to the BFF and Bitcart. Phrase/seed and spend keys are never sent to or stored by the Ágora. ETH accepts a destination address. XMR accepts an address and view key; the key passes transiently through the BFF to be stored by Bitcart for wallet monitoring, but the Ágora does not persist or log it.
- Bitcart's public-registration switch is global, not Agora-specific. Enabling it permits account registration through Bitcart beyond this frontend.
- Payment links, wallet responses, and webhooks must be mapped to explicit domain DTOs before becoming API responses. Raw Bitcart proxying is forbidden.
- Payouts and refunds are out of scope for the first milestone.
