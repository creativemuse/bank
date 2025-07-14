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
  console.log("Creating Coinbase session token for:", { address, blockchains, assets });

  const url = "https://api.developer.coinbase.com";
  const method = "POST";
  const request_path = "/onramp/v1/token";

  try {
    const jwt = await getCoinbaseJWT(url, method, request_path);
    console.log("Generated JWT:", jwt ? "✓ JWT created" : "✗ JWT failed");

    const requestBody = {
      addresses: [
        {
          address,
          blockchains,
        },
      ],
      assets,
    };

    console.log("Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${url}${request_path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const error = await response.text();
      console.error("Coinbase API error response:", error);
      throw new Error(`Coinbase session token creation failed: ${error}`);
    }

    const data = await response.json();
    console.log("Coinbase API response:", JSON.stringify(data, null, 2));

    const token = data.data?.token;
    console.log("Extracted token:", token ? "✓ Token extracted" : "✗ No token in response");

    return token;
  } catch (error) {
    console.error("Session token creation error:", error);
    throw error;
  }
}
