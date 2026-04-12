# Creative Finance (bank)

## Architecture

Creative Bank is a fintech-grade DeFi platform on Base. The architecture separates three concerns:

### Identity Layer (Stytch)
- Stytch Headless SDK handles login (Email OTP, Google OAuth, EVM Crypto Wallet)
- Stytch Node SDK on backend for session validation, OTP send/verify
- JwtSync component bridges Stytch JWT → Crossmint via `useCrossmint().setJwt()`
- Phone verification stores `phoneNumberVerifiedAt` in Stytch `trusted_metadata` for Coinbase "Warm Start"

### Wallet Infrastructure (Crossmint BYOA)
- Crossmint provides non-custodial smart wallets with passkey signers
- Configured for BYOA — accepts Stytch JWTs, no internal auth
- Wallet address is the stable user identifier across all systems

### Membership Layer (Unlock Protocol)
- Source of truth for membership tiers via NFT keys on Base Mainnet
- Three locks: Creative ($30/3mo), Investor ($100/mo), Brand ($1000/mo)
- MembershipContext checks `getHasValidKey(address)` on each lock
- Bouncer contract enforces 10% fee floor on-chain

### Database (CockroachDB Serverless)
- GCP us-east1 (South Carolina) for cloud diversity
- PostgreSQL driver (`pg`) — same pattern as Creative TV's Supabase
- `users` table: `stytch_user_id` (PK) → `wallet_address` (unique)
- `transactions` table: keyed by `wallet_address`, `stytch_user_id` for correlation

### Coinbase Onramp
- Headless v2 API for Express Checkout (Apple Pay / Google Pay — embedded)
- Popup v1 fallback for All Payment Methods (card, ACH, etc.)
- `wallet_address` used as `partnerUserRef` for transaction continuity

### Fee Model (Vault Factory)
- Non-Member: 20% performance fee (hardcoded, read-only)
- Member: 10% floor (editable, "up" only)
- Distribution: `Net_Manager = (F × 0.5) × 0.9` (Aave gets 50%, Yearn gets 10% of manager share)
- Brand/Creator members: Fee Receiver Address field exposed
- Non-member: fees go to Creative Bank Treasury

## Git Workflow

- Default branch: `prod`
- **Always fetch and pull before branching:**
  ```bash
  git fetch origin
  git checkout prod
  git pull origin prod
  ```
- **Create feature branches from up-to-date `prod`:**
  ```bash
  git checkout -b feature/<description> prod
  ```
- **Branch naming:** `feature/*`, `fix/*`, `chore/*`
- **Rebase before pushing:**
  ```bash
  git fetch origin
  git rebase origin/prod
  ```
- **Never commit directly to `prod`** — always use feature branches + PRs
