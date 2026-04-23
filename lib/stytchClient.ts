import { createStytchHeadlessClient } from "@stytch/nextjs";

let stytchClient: ReturnType<typeof createStytchHeadlessClient> | null = null;

export function getStytchHeadlessClient() {
  if (stytchClient) return stytchClient;

  const publicToken = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;
  if (!publicToken) {
    throw new Error("NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN is not set");
  }

  stytchClient = createStytchHeadlessClient(publicToken);
  return stytchClient;
}
