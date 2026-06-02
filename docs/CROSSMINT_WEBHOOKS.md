# Crossmint Webhooks

Creative Bank uses **Crossmint Auth** (not a separate identity provider). Webhooks are received at:

```
POST https://<your-domain>/api/webhooks/crossmint
```

## Console setup

1. Open [Crossmint Console → Webhooks](https://www.crossmint.com/console) (use [staging](https://staging.crossmint.com/console) for testnet).
2. **Add endpoint** with your deployment URL (production, preview, or staging).
3. Subscribe to:
   - `wallets.transfer.in` — incoming ERC-20 transfers (on-chain confirmation)
   - `wallets.transfer.out` — outgoing transfers (on-chain confirmation)
   - `wallets.transfer.transaction.update` — deposit/payout lifecycle updates (terminal `succeeded` / `failed` written to ledger)
   - `wallets.experimental.transfer.updated` — experimental transfer lifecycle updates (same handler)
   - `users.created` — new Crossmint Auth user (syncs email/phone to CockroachDB)
   - `users.updated` — profile changes from Crossmint Auth
4. Copy the **signing secret** (`whsec_...`) into your host environment.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY` | Yes | Client API key (auth + wallets) |
| `CROSSMINT_SERVER_API_KEY` | Yes (server) | Server API key for `/api/auth/crossmint/*` and JWT validation |
| `CROSSMINT_WEBHOOK_SECRET` | Production | Webhook HMAC signing secret from Console |
| `COCKROACHDB_URL` | For persistence | `webhook_events` audit + `transactions` + `users` |

In **production**, webhook requests are rejected if `CROSSMINT_WEBHOOK_SECRET` is unset or signatures are invalid.

## Auth API routes

Crossmint Auth is configured in [`app/providers.tsx`](../app/providers.tsx):

- `POST /api/auth/crossmint/refresh` — session refresh (HttpOnly cookies)
- `POST /api/auth/crossmint/logout` — logout

Protected API routes accept `Authorization: Bearer <jwt>` from `useAuth().jwt`.

## Email recovery

New wallets use `recovery: { type: "email", email }` in [`components/auth/WalletProvisioner.tsx`](../components/auth/WalletProvisioner.tsx), with email from the Crossmint Auth user profile. Preemptive recovery: [`components/auth/WalletRecoveryBootstrap.tsx`](../components/auth/WalletRecoveryBootstrap.tsx).

See [Crossmint recovery docs](https://docs.crossmint.com/wallets/concepts/recovery).

## Verification

1. Console shows successful webhook deliveries (2xx).
2. `webhook_events` rows with `source = 'crossmint'`.
3. `users` rows updated on `users.created` / `users.updated`.
4. Terminal transfers in `transactions` as `transfer_in` / `transfer_out` with `status` `succeeded` or `failed` (from `.in` / `.out` or `.transaction.update` / `.experimental.transfer.updated`).
