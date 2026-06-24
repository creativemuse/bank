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

Add both **Login** and **Sign-up** redirect URLs:

- `http://localhost:3000/authenticate`
- `https://bank.creativeplatform.xyz/authenticate`

### Biometrics / Passkeys

**Disable Stytch biometrics** unless you intentionally want login passkeys. The app provisions a **Crossmint wallet passkey** on first login via `createOnLogin`. Enabling Stytch biometrics causes a double passkey prompt and can loop if wallet creation fails.

### API Keys

Copy from **Project Settings → API Keys**:

- `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` (public token)
- `STYTCH_PROJECT_ID`
- `STYTCH_SECRET`

## Crossmint Console

Under **API Keys → JWT Authentication**:

1. **JWT auth required**: Yes
2. **3P Auth providers**: Stytch
3. **Project ID**: your Stytch project ID (`project-live-...` or `project-test-...`)
4. **Verifier ID**: `sub`

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

# Site URL (recommended for OAuth redirects)
NEXT_PUBLIC_SITE_URL=https://bank.creativeplatform.xyz
```

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
