import * as stytch from "stytch";

let client: stytch.Client | null = null;

export function getStytchClient(): stytch.Client {
  if (client) return client;

  const projectId = process.env.STYTCH_PROJECT_ID;
  const secret = process.env.STYTCH_SECRET;

  if (!projectId || !secret) {
    throw new Error("STYTCH_PROJECT_ID and STYTCH_SECRET must be set in environment variables");
  }

  client = new stytch.Client({
    project_id: projectId,
    secret,
  });

  return client;
}
