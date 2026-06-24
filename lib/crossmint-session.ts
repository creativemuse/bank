import { verifyStytchJwt } from "@/lib/stytchAuth";

/**
 * Validates a Stytch session JWT from Authorization headers and returns the user id.
 */
export async function getUserIdFromStytchJwt(jwt: string): Promise<string> {
  const { userId } = await verifyStytchJwt(jwt);
  return userId;
}
