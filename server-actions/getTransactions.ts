"use server";

import { generateJWT } from "@/utils/coinbase-sdk";

export async function getTransactions(userId: string) {
  // Validate environment variables
  if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
    console.warn("Coinbase API keys not configured, skipping transaction fetch");
    return [];
  }

  // Validate input
  if (!userId) {
    throw new Error("User ID is required to fetch transactions");
  }

  // Allow transaction fetching in any environment if API keys are configured
  // This enables testing withdrawals in development/staging environments

  const url = "api.developer.coinbase.com";
  const method = "GET";
  const request_path = `/onramp/v1/sell/user/${userId}/transactions`;

  try {
    console.log(`Fetching transactions for user: ${userId}`);
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

    console.log(`Fetched ${transactions.length} transactions for user ${userId}`);
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
