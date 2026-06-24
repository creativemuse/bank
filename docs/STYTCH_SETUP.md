# Stytch + Crossmint BYOA Setup

Creative Finance uses **Stytch** for identity (email OTP + Google OAuth) and **Crossmint** for non-custodial wallets. Crossmint validates Stytch session JWTs configured in the Crossmint Console.

## Stytch Dashboard

Configure at [stytch.com/dashboard](https://stytch.com/dashboard):

### SDK Configuration

1. Enable the **Frontend SDK**
2. **Authorized domains** — add each environment exactly (no trailing slash):
   - `http://localhost:3000` (local)
   - `https://bank.creativeplatform.xyz` (production)
3. Enable **Email OTP** (LoginOrCreate flow)
4. Enable **OAuth** → Google (configure redirect URIs per Stytch instructions)

### Redirect URLs

Add both **Login** and **Sign-up** redirect URLs in the **same environment** as your API keys (Test for local, **Live** for production):

| Environment | Login + Sign-up redirect URL |
|-------------|------------------------------|
| Local (Test) | `http://localhost:3000/authenticate` |
| Production (Live) | `https://bank.creativeplatform.xyz/authenticate` |

Use the **exact** URL above — no trailing slash, no `/callback` path. Redirect URLs come from `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` in [`lib/stytchLoginConfig.ts`](../lib/stytchLoginConfig.ts) (not the Vercel preview hostname).

#### Fix "Sign-in link invalid or expired" on `/authenticate`

If Google redirects to `/authenticate` but you see this error:

1. Confirm **Live** redirect URLs include exactly `https://bank.creativeplatform.xyz/authenticate` (not the site root only).
2. In **SDK Configuration**, set **Maximum session duration** to at least **43200** minutes (30 days), or lower `SESSION_DURATION_MINUTES` in [`lib/stytchLoginConfig.ts`](../lib/stytchLoginConfig.ts).
3. Redeploy after env changes. The callback page uses Stytch `authenticateByUrl()` and captures the landing URL before params can be cleared.

#### Fix `no_match_for_provided_oauth_url`

If Google sign-in returns Stytch error `no_match_for_provided_oauth_url`:

1. Confirm you are editing **Live** redirect URLs when production uses `public-token-live-...` keys.
2. Add `https://bank.creativeplatform.xyz/authenticate` as **both** Login and Sign-up types.
3. Do **not** register only `https://bank.creativeplatform.xyz` without `/authenticate`.
4. Remove stale URLs such as `/api/auth/stytch/callback` or `https://finance.creativeplatform.xyz/*` if unused.
5. Redeploy after setting `NEXT_PUBLIC_SITE_URL=https://bank.creativeplatform.xyz` in Vercel.

#### Automate redirect URL registration (optional)

If you have a [Stytch Workspace Management API key](https://stytch.com/dashboard/settings/management-api), run:

```bash
export STYTCH_WORKSPACE_KEY_ID=workspace-key-prod-...
export STYTCH_WORKSPACE_SECRET=...
export STYTCH_PROJECT_SLUG=your-project-slug   # from dashboard URL, not project-live-...
export STYTCH_ENVIRONMENT_SLUG=live            # or test for local
./scripts/stytch-ensure-redirect-urls.sh
```

### Biometrics / Passkeys

**Disable Stytch biometrics** unless you intentionally want login passkeys. The app provisions a **Crossmint wallet passkey** on first login via `createOnLogin`. Enabling Stytch biometrics causes a double passkey prompt and can loop if wallet creation fails.

### API Keys

Copy from **Project Settings → API Keys**:

- `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` (public token)
- `STYTCH_PROJECT_ID`
- `STYTCH_SECRET`

## Crossmint Console

Under [crossmint.com/console → API Keys](https://www.crossmint.com/console/projects/apiKeys):

1. **Authorized web origins** (client key): `https://bank.creativeplatform.xyz` and `http://localhost:3000`
2. **JWT Authentication → JWT auth required**: Yes
3. **3P Auth providers**: Stytch
4. **Project ID**: your Stytch **Live** project ID in production (`project-live-...`)
5. **Verifier ID**: `sub`

Wallet scopes on the client key must include `wallets.create` and `wallets.read`.

## Environment Variables

```env
# Stytch (Required)
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=public-token-...
STYTCH_PROJECT_ID=project-live-...
STYTCH_SECRET=secret-live-...

# Crossmint (Required)
NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY=...
CROSSMINT_SERVER_SIDE_API_KEY=...

# Site URL (OAuth redirect fallback + WalletConnect metadata)
NEXT_PUBLIC_SITE_URL=https://bank.creativeplatform.xyz
NEXT_PUBLIC_APP_URL=https://bank.creativeplatform.xyz
```

Set the same values in **Vercel → Production** (and Preview if needed). `NEXT_PUBLIC_SITE_URL` was added for OAuth; both vars should point at `bank.creativeplatform.xyz`, not `finance.creativeplatform.xyz`.

## Architecture

```
User → StytchLogin (email OTP / Google)
     → Stytch session JWT
     → JwtSync → Crossmint setJwt()
     → CrossmintWalletProvider createOnLogin (passkey or email fallback)
     → API routes verify Stytch JWT via lib/stytchAuth.ts
```

## User migration

Existing users who signed in with Crossmint Auth are re-linked on first Stytch login by **email** (`server-actions/getTransactions.ts` → `upsertUser`). The `users.crossmint_user_id` column stores the Stytch `user_id` going forward.
