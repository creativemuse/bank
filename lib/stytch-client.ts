import { createStytchUIClient } from "@stytch/nextjs";

let stytchUIClient: ReturnType<typeof createStytchUIClient> | null = null;

export const getStytchUIClient = () => {
  if (stytchUIClient) return stytchUIClient;

  const publicToken = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;
  if (!publicToken) {
    throw new Error("NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN is not set");
  }

  stytchUIClient = createStytchUIClient(publicToken);
  return stytchUIClient;
};
