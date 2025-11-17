"use server";

import { generateJWT } from "@/utils/coinbase-sdk";
import { getTablelandDatabase } from "@/lib/tableland";

// Get table name from environment - must be the full table name (prefix_chainId_tableId)
const getTableName = () => {
  const tableName = process.env.TABLELAND_TABLE_NAME;
  if (!tableName || tableName === "transactions") {
    console.warn("TABLELAND_TABLE_NAME not properly configured. Using fallback.");
    return null; // Will skip Tableland and use API directly
  }
  return tableName;
};

export async function getTransactions(userId: string) {
  // Validate input
  if (!userId) {
    throw new Error("User ID is required to fetch transactions");
  }

  // First, try to get cached transactions from Tableland
  const tableName = getTableName();
  if (!tableName) {
    // Skip Tableland if table name not configured, go straight to API
    return await fetchTransactionsFromAPI(userId);
  }

  try {
    const db = await getTablelandDatabase();
    
    console.log(`Querying Tableland table: ${tableName}`);
    
    // Quote table name to handle special characters
    const { results } = await db
      .prepare(
        `SELECT * FROM "${tableName}" 
         WHERE user_id = ? 
         ORDER BY created_at DESC`
      )
      .bind(userId)
      .all();
    
    if (results && results.length > 0) {
      console.log(`Returning ${results.length} cached transactions from Tableland for user: ${userId}`);
      
      // Trigger background sync (don't await)
      syncTransactionsFromAPI(userId).catch(err => 
        console.error("Background sync failed:", err)
      );
      
      // Parse raw_data JSON strings back to objects
      return results.map((row: any) => {
        try {
          return row.raw_data ? JSON.parse(row.raw_data) : row;
        } catch {
          return row;
        }
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`Tableland fetch failed (${error.message}), falling back to API`);
      if (error.message.includes("Invalid table name") || error.message.includes("no such table")) {
        console.error(`Table name issue: ${tableName}. Make sure TABLELAND_TABLE_NAME is set correctly in .env.local`);
        console.error(`Expected format: transactions_8453_26 (prefix_chainId_tableId)`);
      }
    } else {
      console.warn("Tableland fetch failed, falling back to API:", error);
    }
  }

  // Fallback to API if no cached data
  return await fetchTransactionsFromAPI(userId);
}

async function fetchTransactionsFromAPI(userId: string) {
  // Validate environment variables
  if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
    console.warn("Coinbase API keys not configured, skipping transaction fetch");
    return [];
  }

  // Allow transaction fetching in any environment if API keys are configured
  // This enables testing withdrawals in development/staging environments

  const url = "api.developer.coinbase.com";
  const method = "GET";
  const request_path = `/onramp/v1/sell/user/${userId}/transactions`;

  try {
    console.log(`Fetching transactions from API for user: ${userId}`);
    console.log("Request details:", {
      method,
      url: `https://${url}${request_path}`,
      requestPath: request_path,
    });

    // Use the new CDP SDK to generate JWT with correct request parameters
    const jwt = await generateJWT(
      process.env.COINBASE_API_KEY_ID,
      process.env.COINBASE_API_KEY_SECRET,
      method,
      request_path
    );

    console.log("JWT generated, making request...");

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
        statusText: response.statusText,
        error: errorText,
        userId,
        requestPath: request_path,
        method,
      });

      // Handle specific error cases
      if (response.status === 401) {
        throw new Error("Invalid Coinbase API credentials");
      } else if (response.status === 403) {
        throw new Error("Insufficient permissions to fetch transactions");
      } else if (response.status === 404) {
        // User might not have any transactions yet
        console.log(`No transactions found for user: ${userId}`);
        return [];
      } else if (response.status >= 500) {
        throw new Error("Coinbase service temporarily unavailable");
      }

      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const transactions = data.transactions || [];

    // Store transactions in Tableland
    await storeTransactionsInTableland(userId, transactions);

    console.log(`Fetched and stored ${transactions.length} transactions for user ${userId}`);
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);

    // Re-throw with more context for authentication errors
    if (error instanceof Error && error.message.includes("credentials")) {
      throw error;
    }

    // For other errors, return empty array to allow app to continue
    return [];
  }
}

async function syncTransactionsFromAPI(userId: string) {
  try {
    const transactions = await fetchTransactionsFromAPI(userId);
    await storeTransactionsInTableland(userId, transactions);
  } catch (error) {
    console.error("Error syncing transactions:", error);
  }
}

async function storeTransactionsInTableland(userId: string, transactions: any[]) {
  if (!transactions || transactions.length === 0) return;

  try {
    const tableName = getTableName();
    if (!tableName) {
      console.warn("Skipping Tableland storage - table name not configured");
      return;
    }

    const db = await getTablelandDatabase();
    
    // Use batch for better performance when storing multiple transactions
    // This reduces network round trips and is more efficient
    const statements = transactions
      .filter((tx) => tx && (tx.transaction_id || tx.id)) // Filter out invalid transactions
      .map((tx) => {
        const transactionId = tx.transaction_id || tx.id;
        const now = Date.now();
        
        return db
          .prepare(
            `INSERT OR REPLACE INTO "${tableName}" 
             (user_id, transaction_id, status, to_address, from_address, 
              sell_amount_value, sell_amount_currency, buy_amount_value, buy_amount_currency,
              created_at, updated_at, raw_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            userId,
            transactionId,
            tx.status || "unknown",
            tx.to_address || null,
            tx.from_address || null,
            tx.sell_amount?.value || null,
            tx.sell_amount?.currency || null,
            tx.buy_amount?.value || null,
            tx.buy_amount?.currency || null,
            tx.created_at || now,
            now,
            JSON.stringify(tx)
          );
      });

    // Skip if no valid statements
    if (statements.length === 0) {
      console.warn("No valid transactions to store in Tableland");
      return;
    }

    // Execute all inserts in a single batch transaction
    const [{ meta }] = await db.batch(statements);
    await meta.txn?.wait();

    console.log(`Stored ${transactions.length} transactions in Tableland for user ${userId}`);
  } catch (error) {
    console.error("Error storing transactions in Tableland:", error);
    // Don't throw - allow app to continue even if storage fails
  }
}
