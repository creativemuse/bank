import { NextRequest, NextResponse } from "next/server";
import { getStytchClient } from "@/lib/stytch";
import { getPool } from "@/lib/cockroachdb";

export type AuthedSession = {
  userId: string;
  walletAddress: string;
};

type AuthResult =
  | { ok: true; session: AuthedSession }
  | { ok: false; response: NextResponse };

/**
 * Validates a Stytch session and resolves the authed user's wallet from
 * CockroachDB. Session token is read from (in order):
 *   1. `Authorization: Bearer <token>` header
 *   2. `x-stytch-session-token` header
 *   3. `bodySessionToken` argument (for POST/PATCH that put it in the body)
 *
 * Returns the session's canonical wallet (lowercased) — never trust a
 * wallet address from the client; always use the one returned here.
 */
export async function requireAuthedWallet(
  request: NextRequest,
  bodySessionToken?: unknown
): Promise<AuthResult> {
  const token =
    extractBearer(request.headers.get("authorization")) ??
    request.headers.get("x-stytch-session-token") ??
    (typeof bodySessionToken === "string" ? bodySessionToken : null);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  let userId: string;
  try {
    const stytch = getStytchClient();
    const res = await stytch.sessions.authenticate({ session_token: token });
    userId = res.session.user_id;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }),
    };
  }

  if (!process.env.COCKROACHDB_URL) {
    return {
      ok: false,
      response: NextResponse.json({ error: "User directory unavailable" }, { status: 503 }),
    };
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT wallet_address FROM users WHERE stytch_user_id = $1 LIMIT 1`,
    [userId]
  );

  if (rows.length === 0 || !rows[0].wallet_address) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No wallet linked to this account" }, { status: 404 }),
    };
  }

  return {
    ok: true,
    session: { userId, walletAddress: String(rows[0].wallet_address).toLowerCase() },
  };
}

/**
 * If the client passed a wallet address (query param or body field), confirm
 * it matches the session's canonical wallet. Returns a 403 response if not.
 * Callers should still use `session.walletAddress` — this only guards against
 * accidental cross-wallet requests from the client.
 */
export function assertWalletMatches(
  sessionWallet: string,
  claimed: unknown
): NextResponse | null {
  if (claimed == null || claimed === "") return null;
  if (typeof claimed !== "string") {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  if (claimed.toLowerCase() !== sessionWallet) {
    return NextResponse.json(
      { error: "Wallet address does not match authenticated session" },
      { status: 403 }
    );
  }
  return null;
}

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && value) return value.trim();
  return null;
}
