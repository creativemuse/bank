-- Creative Bank Ledger Schema
-- CockroachDB Serverless on GCP (us-east1)
-- Migrated from Tableland for ACID compliance

-- Users: Stytch user ID is the primary identity key
-- Wallet address is the secondary lookup (stable across auth provider changes)
CREATE TABLE IF NOT EXISTS users (
  stytch_user_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  membership_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address
  ON users (wallet_address);

-- Transactions: The bank ledger
-- wallet_address is the primary lookup key (used by Coinbase partnerUserId)
-- stytch_user_id is stored for identity correlation
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  stytch_user_id TEXT,
  transaction_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'offramp',
  status TEXT NOT NULL DEFAULT 'unknown',
  to_address TEXT,
  from_address TEXT,
  sell_amount_value TEXT,
  sell_amount_currency TEXT,
  buy_amount_value TEXT,
  buy_amount_currency TEXT,
  onchain_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB
);

-- Primary lookup: by wallet address
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address
  ON transactions (wallet_address);

-- Secondary lookup: by Stytch user ID
CREATE INDEX IF NOT EXISTS idx_transactions_stytch_user_id
  ON transactions (stytch_user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions (status);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON transactions (created_at DESC);

-- Composite: most common query (wallet + status filter + time sort)
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_status
  ON transactions (wallet_address, status, created_at DESC);
