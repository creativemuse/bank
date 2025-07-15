"use server";

export async function checkCoinbaseConfig() {
  return {
    isConfigured: !!(process.env.COINBASE_API_KEY_ID && process.env.COINBASE_API_KEY_SECRET),
  };
}
