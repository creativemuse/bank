"use server";

export async function debugCoinbaseConfig() {
  const hasKeyId = !!process.env.COINBASE_API_KEY_ID;
  const hasKeySecret = !!process.env.COINBASE_API_KEY_SECRET;
  const isConfigured = hasKeyId && hasKeySecret;
  const isProduction = process.env.NODE_ENV === "production";

  // Check key lengths (without revealing the actual keys)
  const keyIdLength = process.env.COINBASE_API_KEY_ID?.length || 0;
  const keySecretLength = process.env.COINBASE_API_KEY_SECRET?.length || 0;

  console.log("Debug Coinbase configuration:", {
    hasKeyId,
    hasKeySecret,
    isConfigured,
    isProduction,
    nodeEnv: process.env.NODE_ENV,
    keyIdLength,
    keySecretLength,
  });

  return {
    isConfigured,
    isProduction,
    hasKeyId,
    hasKeySecret,
    keyIdLength,
    keySecretLength,
    nodeEnv: process.env.NODE_ENV,
  };
}
