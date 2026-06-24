import { getStytchClient } from "@/lib/stytch-server";

export type VerifiedStytchSession = {
  userId: string;
};

/**
 * Validates a Stytch session JWT and returns the user id (`sub`).
 */
export const verifyStytchJwt = async (token: string): Promise<VerifiedStytchSession> => {
  const client = getStytchClient();
  const { session } = await client.sessions.authenticateJwt({ session_jwt: token });

  const userId = session.user_id;
  if (!userId) {
    throw new Error("JWT missing user identifier");
  }

  return { userId };
};
