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
 * Upserts a user record linking Crossmint identity to wallet address.
 */
export async function upsertUser(
  crossmintUserId: string,
  walletAddress: string,
  email?: string,
  phoneNumber?: string
) {
  if (!process.env.COCKROACHDB_URL) return;

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO users (crossmint_user_id, wallet_address, email, phone_number, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (crossmint_user_id) DO UPDATE SET
         wallet_address = EXCLUDED.wallet_address,
         email = COALESCE(EXCLUDED.email, users.email),
         phone_number = COALESCE(EXCLUDED.phone_number, users.phone_number),
         updated_at = now()`,
      [crossmintUserId, walletAddress.toLowerCase(), email || null, phoneNumber || null]
    );
  } catch (error) {
    console.error("[CockroachDB] Failed to upsert user:", error);
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
    const transactions = data.transactions || data || [];

    if (Array.isArray(transactions) && transactions.length > 0) {
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

async function storeTransactions(
  walletAddress: string,
  transactions: any[],
  crossmintUserId?: string
) {
  if (!process.env.COCKROACHDB_URL) return;

  const pool = getPool();

  for (const tx of transactions) {
    const transactionId = tx.transaction_id || tx.id || tx.transactionId;
    if (!transactionId) continue;

    const sellAmount = tx.sell_amount || tx.sellAmount || {};
    const buyAmount = tx.buy_amount || tx.buyAmount || {};

    try {
      await pool.query(
        `
        INSERT INTO transactions (
          wallet_address, crossmint_user_id, transaction_id, type, status,
          to_address, from_address,
          sell_amount_value, sell_amount_currency,
          buy_amount_value, buy_amount_currency,
          onchain_hash, raw_data, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
        ON CONFLICT (transaction_id) DO UPDATE SET
          status = EXCLUDED.status,
          raw_data = EXCLUDED.raw_data,
          updated_at = now()
        `,
        [
          walletAddress.toLowerCase(),
          crossmintUserId || null,
          transactionId,
          tx.type || "offramp",
          tx.status || "unknown",
          tx.to_address || tx.toAddress || null,
          tx.from_address || tx.fromAddress || null,
          sellAmount.value || sellAmount.amount || null,
          sellAmount.currency || null,
          buyAmount.value || buyAmount.amount || null,
          buyAmount.currency || null,
          tx.onchain_hash || tx.onchainHash || tx.hash || null,
          JSON.stringify(tx),
        ]
      );
    } catch (error) {
      console.error(`Failed to store transaction ${transactionId}:`, error);
    }
  }
}
