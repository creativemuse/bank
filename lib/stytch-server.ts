import * as stytch from "stytch";

let stytchClient: stytch.Client | null = null;

export const getStytchClient = (): stytch.Client => {
  if (stytchClient) return stytchClient;

  const projectId = process.env.STYTCH_PROJECT_ID;
  const secret = process.env.STYTCH_SECRET;

  if (!projectId || !secret) {
    throw new Error("STYTCH_PROJECT_ID and STYTCH_SECRET must be set");
  }

  stytchClient = new stytch.Client({
    project_id: projectId,
    secret,
  });

  return stytchClient;
};
