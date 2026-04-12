import { Pool } from "pg";

let pool: Pool | null = null;

/**
 * Returns a singleton PostgreSQL connection pool for CockroachDB Serverless (GCP us-east1).
 * Uses the standard `pg` driver — same pattern as Creative TV's Supabase setup.
 * CockroachDB is wire-compatible with PostgreSQL.
 */
export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.COCKROACHDB_URL;
  if (!connectionString) {
    throw new Error(
      "COCKROACHDB_URL is required. Set it to your CockroachDB Serverless connection string.",
    );
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  pool.on("error", (err) => {
    console.error("[CockroachDB] Unexpected pool error:", err.message);
  });

  return pool;
}

/**
 * Run the database schema migration.
 * Safe to call multiple times — all statements use IF NOT EXISTS.
 *
 * Schema design:
 * - `users` table: Stytch user_id is the primary key, linked to wallet address
 * - `transactions` table: Ledger entries keyed by wallet_address for lookups
 */
export async function runMigration(): Promise<void> {
  const db = getPool();

  // Users table — Stytch user ID is the primary identity
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      stytch_user_id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      email TEXT,
      phone_number TEXT,
      membership_tier TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address
    ON users (wallet_address);
  `);

  // Transactions table — the bank ledger
  await db.query(`
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
  `);

  // Primary lookup: by wallet address (how we query everywhere)
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address
    ON transactions (wallet_address);
  `);

  // Secondary lookup: by Stytch user ID
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_stytch_user_id
    ON transactions (stytch_user_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON transactions (status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions (created_at DESC);
  `);

  // Composite index for the most common query pattern
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet_status
    ON transactions (wallet_address, status, created_at DESC);
  `);

  console.log("[CockroachDB] Migration complete — users + transactions tables ready");
}
