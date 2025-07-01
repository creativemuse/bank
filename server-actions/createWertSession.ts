"use server";

export default async function createWertSession({
  walletAddress,
  amount,
  email,
}: {
  walletAddress: string;
  amount: string;
  email?: string;
}) {
  const apiKey = process.env.WERT_API_KEY;
  if (!apiKey) throw new Error("WERT_API_KEY is not set");

  const response = await fetch("https://partner.wert.io/api/external/hpp/create-session", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      flow_type: "simple_full_restrict",
      wallet_address: walletAddress,
      commodity: "USDC",
      network: "base",
      commodity_amount: Number(amount),
      ...(email ? { email } : {}),
      currency: "USD",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Wert session creation failed: ${error}`);
  }

  const data = await response.json();
  return data.sessionId;
}
