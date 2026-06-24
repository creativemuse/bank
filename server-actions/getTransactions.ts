"use server";

import { generateJWT } from "@/utils/coinbase-sdk";
import { getPool } from "@/lib/cockroachdb";

/**
 * Fetches transactions for a wallet address.
 * Primary lookup is by wallet_address (stable identifier across auth migrations).
 */
export async function getTransactions(walletAddress: string, crossmintUserId?: string) {
  if (!walletAddress) {
    throw new Error("Wallet address is required to fetch transactions");
  }

  if (process.env.COCKROACHDB_URL) {
    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT raw_data FROM transactions
         WHERE wallet_address = $1
         ORDER BY created_at DESC`,
        [walletAddress.toLowerCase()]
      );

      if (rows.length > 0) {
        console.log(
          `[CockroachDB] Returning ${rows.length} cached transactions for wallet: ${walletAddress}`
        );

        syncTransactionsFromAPI(walletAddress, crossmintUserId).catch((err) =>
          console.error("Background sync failed:", err)
        );

        return rows.map((row: { raw_data: unknown }) => row.raw_data);
      }
    } catch (error) {
      console.warn(
        "[CockroachDB] Fetch failed, falling back to API:",
        error instanceof Error ? error.message : error
      );
    }
  }

  return await fetchTransactionsFromAPI(walletAddress, crossmintUserId);
}

/**
 * Upserts a user record linking auth identity to wallet address.
 */
export async function upsertUser(
  authUserId: string,
  walletAddress: string,
  email?: string,
  phoneNumber?: string
) {
  if (!process.env.COCKROACHDB_URL) return;

  const pool = getPool();
  const normalizedWallet = walletAddress.toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase() || null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let walletToStore = normalizedWallet;
    let phoneToStore = phoneNumber || null;

    // Link existing rows created under Crossmint Auth when the same email signs in via Stytch.
    if (normalizedEmail) {
      const { rows: legacyRows } = await client.query<{
        crossmint_user_id: string;
        wallet_address: string | null;
        phone_number: string | null;
      }>(
        `SELECT crossmint_user_id, wallet_address, phone_number
         FROM users
         WHERE lower(email) = $1
           AND crossmint_user_id <> $2
         LIMIT 1`,
        [normalizedEmail, authUserId]
      );

      if (legacyRows.length > 0) {
        const legacy = legacyRows[0];
        if (legacy.wallet_address) {
          walletToStore = legacy.wallet_address.toLowerCase();
        }
        if (!phoneToStore && legacy.phone_number) {
          phoneToStore = legacy.phone_number;
        }

        await client.query(
          `UPDATE transactions SET crossmint_user_id = $1 WHERE crossmint_user_id = $2`,
          [authUserId, legacy.crossmint_user_id]
        );
        await client.query(`DELETE FROM users WHERE crossmint_user_id = $1`, [
          legacy.crossmint_user_id,
        ]);
      }
    }

    // If this wallet is already linked to a different auth user, re-key that row first.
    const { rows: walletOwnerRows } = await client.query<{ crossmint_user_id: string }>(
      `SELECT crossmint_user_id
       FROM users
       WHERE lower(wallet_address) = $1
         AND crossmint_user_id <> $2
       LIMIT 1`,
      [walletToStore, authUserId]
    );

    if (walletOwnerRows.length > 0) {
      const priorOwnerId = walletOwnerRows[0].crossmint_user_id;
      await client.query(
        `UPDATE transactions SET crossmint_user_id = $1 WHERE crossmint_user_id = $2`,
        [authUserId, priorOwnerId]
      );
      await client.query(`DELETE FROM users WHERE crossmint_user_id = $1`, [priorOwnerId]);
    }

    await client.query(
      `INSERT INTO users (crossmint_user_id, wallet_address, email, phone_number, email_verified_at, updated_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $3 IS NOT NULL THEN now() ELSE NULL END, now())
       ON CONFLICT (crossmint_user_id) DO UPDATE SET
         wallet_address = COALESCE(NULLIF(users.wallet_address, ''), EXCLUDED.wallet_address),
         email = COALESCE(EXCLUDED.email, users.email),
         phone_number = COALESCE(EXCLUDED.phone_number, users.phone_number),
         email_verified_at = CASE
           WHEN EXCLUDED.email IS NOT NULL THEN COALESCE(users.email_verified_at, now())
           ELSE users.email_verified_at
         END,
         updated_at = now()`,
      [authUserId, walletToStore, normalizedEmail, phoneToStore]
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[CockroachDB] Rollback failed:", rollbackError);
    }
    console.error("[CockroachDB] Failed to upsert user:", error);
  } finally {
    client.release();
  }
}

async function fetchTransactionsFromAPI(walletAddress: string, crossmintUserId?: string) {
  if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
    console.warn("Coinbase API keys not configured, skipping transaction fetch");
    return [];
  }

  const url = "api.developer.coinbase.com";
  const method = "GET";
  const request_path = `/onramp/v1/sell/user/${walletAddress}/transactions`;

  try {
    console.log(`Fetching transactions from Coinbase API for wallet: ${walletAddress}`);

    const jwt = await generateJWT(
      process.env.COINBASE_API_KEY_ID,
      process.env.COINBASE_API_KEY_SECRET,
      method,
      request_path,
      url
    );

    const response = await fetch(`https://${url}${request_path}`, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Coinbase API error (${response.status}):`, errorText);
      return [];
    }

    const data = await response.json();
    const transactions = normalizeTransactionsResponse(data);

    if (transactions.length > 0) {
      await storeTransactions(walletAddress, transactions, crossmintUserId);
    }

    return transactions;
  } catch (error) {
    console.error("Error fetching transactions from Coinbase:", error);
    return [];
  }
}

async function syncTransactionsFromAPI(walletAddress: string, crossmintUserId?: string) {
  try {
    await fetchTransactionsFromAPI(walletAddress, crossmintUserId);
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

const normalizeTransactionsResponse = (data: unknown): any[] => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const record = data as Record<string, unknown>;
  const nested = record.transactions;

  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === "object") return [nested];
  return [record];
};

async function storeTransactions(
  walletAddress: string,
  transactions: any[],
  crossmintUserId?: string
) {
  if (!transactions.length) return;
  if (!process.env.COCKROACHDB_URL) return;

  try {
    const pool = getPool();
    const normalizedAddress = walletAddress.toLowerCase();

    const validTxs = transactions.filter((tx) => tx && (tx.transaction_id || tx.id));

    if (validTxs.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < validTxs.length; i++) {
      const tx = validTxs[i];
      const sellAmount = (tx.sell_amount ?? tx.sellAmount ?? {}) as Record<string, unknown>;
      const buyAmount = (tx.buy_amount ?? tx.buyAmount ?? {}) as Record<string, unknown>;
      const offset = i * 13;

      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, now())`
      );

      values.push(
        normalizedAddress,
        crossmintUserId || null,
        tx.transaction_id || tx.id,
        tx.type || "offramp",
        tx.status || "unknown",
        tx.to_address || tx.toAddress || null,
        tx.from_address || tx.fromAddress || null,
        sellAmount.value || sellAmount.amount || null,
        sellAmount.currency || null,
        buyAmount.value || buyAmount.amount || null,
        buyAmount.currency || null,
        tx.onchain_hash || tx.onchainHash || tx.hash || null,
        JSON.stringify(tx)
      );
    }

    await pool.query(
      `INSERT INTO transactions (
        wallet_address, crossmint_user_id, transaction_id, type, status,
        to_address, from_address,
        sell_amount_value, sell_amount_currency,
        buy_amount_value, buy_amount_currency,
        onchain_hash, raw_data, updated_at
      ) VALUES ${placeholders.join(", ")}
      ON CONFLICT (transaction_id) DO UPDATE SET
        status = EXCLUDED.status,
        onchain_hash = EXCLUDED.onchain_hash,
        raw_data = EXCLUDED.raw_data,
        updated_at = now()`,
      values
    );

    console.log(`[CockroachDB] Stored ${validTxs.length} transactions for wallet ${walletAddress}`);
  } catch (error) {
    console.error("[CockroachDB] Error storing transactions:", error);
  }
}
