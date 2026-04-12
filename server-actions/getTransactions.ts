"use server";

import { generateJWT } from "@/utils/coinbase-sdk";
import { getPool } from "@/lib/cockroachdb";

/**
 * Fetches transactions for a wallet address.
 * Primary lookup is by wallet_address (stable identifier across auth migrations).
 * Stytch user ID is stored alongside for identity correlation.
 */
export async function getTransactions(
  walletAddress: string,
  stytchUserId?: string,
) {
  if (!walletAddress) {
    throw new Error("Wallet address is required to fetch transactions");
  }

  // Try CockroachDB first
  if (process.env.COCKROACHDB_URL) {
    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT raw_data FROM transactions
         WHERE wallet_address = $1
         ORDER BY created_at DESC`,
        [walletAddress.toLowerCase()],
      );

      if (rows.length > 0) {
        console.log(
          `[CockroachDB] Returning ${rows.length} cached transactions for wallet: ${walletAddress}`,
        );

        // Background sync (don't await)
        syncTransactionsFromAPI(walletAddress, stytchUserId).catch((err) =>
          console.error("Background sync failed:", err),
        );

        return rows.map((row: any) => row.raw_data);
      }
    } catch (error) {
      console.warn(
        "[CockroachDB] Fetch failed, falling back to API:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return await fetchTransactionsFromAPI(walletAddress, stytchUserId);
}

/**
 * Upserts a user record linking Stytch identity to wallet address.
 */
export async function upsertUser(
  stytchUserId: string,
  walletAddress: string,
  email?: string,
  phoneNumber?: string,
) {
  if (!process.env.COCKROACHDB_URL) return;

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO users (stytch_user_id, wallet_address, email, phone_number, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (stytch_user_id) DO UPDATE SET
         wallet_address = EXCLUDED.wallet_address,
         email = COALESCE(EXCLUDED.email, users.email),
         phone_number = COALESCE(EXCLUDED.phone_number, users.phone_number),
         updated_at = now()`,
      [stytchUserId, walletAddress.toLowerCase(), email || null, phoneNumber || null],
    );
  } catch (error) {
    console.error("[CockroachDB] Failed to upsert user:", error);
  }
}

async function fetchTransactionsFromAPI(
  walletAddress: string,
  stytchUserId?: string,
) {
  if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
    console.warn("Coinbase API keys not configured, skipping transaction fetch");
    return [];
  }

  // Coinbase uses walletAddress as the partnerUserId
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
      console.error("Failed to fetch transactions:", {
        status: response.status,
        error: errorText,
        walletAddress,
      });

      if (response.status === 401) {
        throw new Error("Invalid Coinbase API credentials");
      } else if (response.status === 404) {
        return [];
      } else if (response.status >= 500) {
        throw new Error("Coinbase service temporarily unavailable");
      }

      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const transactions = data.transactions || [];

    await storeTransactions(walletAddress, transactions, stytchUserId);

    console.log(
      `Fetched and stored ${transactions.length} transactions for wallet ${walletAddress}`,
    );
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);

    if (error instanceof Error && error.message.includes("credentials")) {
      throw error;
    }

    return [];
  }
}

async function syncTransactionsFromAPI(
  walletAddress: string,
  stytchUserId?: string,
) {
  try {
    await fetchTransactionsFromAPI(walletAddress, stytchUserId);
  } catch (error) {
    console.error("Error syncing transactions:", error);
  }
}

async function storeTransactions(
  walletAddress: string,
  transactions: any[],
  stytchUserId?: string,
) {
  if (!transactions || transactions.length === 0) return;
  if (!process.env.COCKROACHDB_URL) return;

  try {
    const pool = getPool();
    const normalizedAddress = walletAddress.toLowerCase();

    // Filter valid transactions and build batch values
    const validTxs = transactions.filter(
      (tx) => tx && (tx.transaction_id || tx.id),
    );

    if (validTxs.length === 0) return;

    // Build a single batch INSERT with multiple value rows
    const values: any[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < validTxs.length; i++) {
      const tx = validTxs[i];
      const offset = i * 13;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, now())`,
      );
      values.push(
        normalizedAddress,
        stytchUserId || null,
        tx.transaction_id || tx.id,
        tx.type || "offramp",
        tx.status || "unknown",
        tx.to_address || null,
        tx.from_address || null,
        tx.sell_amount?.value || null,
        tx.sell_amount?.currency || null,
        tx.buy_amount?.value || null,
        tx.buy_amount?.currency || null,
        tx.onchain_hash || null,
        JSON.stringify(tx),
      );
    }

    await pool.query(
      `INSERT INTO transactions (
        wallet_address, stytch_user_id, transaction_id, type, status,
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
      values,
    );

    console.log(
      `[CockroachDB] Stored ${validTxs.length} transactions for wallet ${walletAddress}`,
    );
  } catch (error) {
    console.error("[CockroachDB] Error storing transactions:", error);
  }
}
