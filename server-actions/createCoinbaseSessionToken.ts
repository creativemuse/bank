"use server";

import { getCoinbaseJWT } from "@/utils/coinbase";

export default async function createCoinbaseSessionToken({
  address,
  blockchains,
  assets,
}: {
  address: string;
  blockchains: string[];
  assets: string[];
}) {
  // Validate environment variables
  if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
    console.error("Missing Coinbase API keys:", {
      hasKeyId: !!process.env.COINBASE_API_KEY_ID,
      hasKeySecret: !!process.env.COINBASE_API_KEY_SECRET,
      nodeEnv: process.env.NODE_ENV,
    });
    throw new Error(
      "Coinbase API keys are not configured. Please check your environment variables."
    );
  }

  // Validate input parameters
  if (!address || !blockchains.length || !assets.length) {
    throw new Error("Missing required parameters: address, blockchains, or assets");
  }

  // More flexible production check - allow if we're not in development
  if (process.env.NODE_ENV === "development") {
    throw new Error("Withdrawals are only enabled in production.");
  }

  const url = "https://api.developer.coinbase.com";
  const method = "POST";
  const request_path = "/onramp/v1/token";

  try {
    const jwt = await getCoinbaseJWT(url, method, request_path);

    const requestBody = {
      addresses: [
        {
          address,
          blockchains,
        },
      ],
      assets,
    };

    console.log("Creating session token with:", {
      address,
      blockchains,
      assets,
      hasJWT: !!jwt,
    });

    const response = await fetch(`${url}${request_path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Coinbase session token creation failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      // Provide more specific error messages based on status codes
      if (response.status === 401) {
        throw new Error("Invalid Coinbase API credentials. Please check your API keys.");
      } else if (response.status === 403) {
        throw new Error("Insufficient permissions. Please check your API key permissions.");
      } else if (response.status === 429) {
        throw new Error("Too many requests. Please try again later.");
      } else if (response.status >= 500) {
        throw new Error("Coinbase service is temporarily unavailable. Please try again later.");
      } else {
        throw new Error(`Coinbase API error (${response.status}): ${errorText}`);
      }
    }

    const data = await response.json();
    const token = data.data?.token;

    if (!token) {
      console.error("No token in response:", data);
      throw new Error("No session token received from Coinbase API");
    }

    console.log("Session token created successfully");
    return token;
  } catch (error) {
    console.error("Session token creation error:", error);

    // Re-throw with a more user-friendly message if it's a network error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Network error: Unable to connect to Coinbase API. Please check your connection."
      );
    }

    throw error;
  }
}
