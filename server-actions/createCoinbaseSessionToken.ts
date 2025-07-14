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

    const response = await fetch(`${url}${request_path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Coinbase session token creation failed with status:", response.status);
      throw new Error(`Coinbase session token creation failed: ${error}`);
    }

    const data = await response.json();
    const token = data.data?.token;

    if (!token) {
      throw new Error("No session token received from Coinbase API");
    }

    return token;
  } catch (error) {
    console.error(
      "Session token creation error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}
