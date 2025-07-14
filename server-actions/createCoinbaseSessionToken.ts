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

  const jwt = await getCoinbaseJWT(url, method, request_path);

  const response = await fetch(`${url}${request_path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses: [
        {
          address,
          blockchains,
        },
      ],
      assets,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Coinbase session token creation failed: ${error}`);
  }

  const data = await response.json();
  return data.data.token;
}
