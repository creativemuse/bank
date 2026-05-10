"use client";

import { useEffect } from "react";
import { useCrossmint } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";

/**
 * Bridges Stytch JWT → Crossmint via setJwt().
 * Renders nothing. Must be placed inside CrossmintWalletProvider.
 *
 * - Sets the JWT on Crossmint when the Stytch session JWT is available.
 * - Clears it on logout so Crossmint doesn't hold a stale token.
 *
 * Depends on session ID (not just JWT string) to catch background
 * session refreshes and prevent auth "dead zones".
 */
export function JwtSync() {
  const { jwt } = useAuth();
  const { setJwt } = useCrossmint();

  useEffect(() => {
    // Pass the JWT (or undefined to clear) so Crossmint knows when the user
    // signs out. Without this, the Crossmint provider can hold a stale JWT
    // after sign-out, which manifests as wallet sync issues on the next login.
    setJwt(jwt ?? undefined);
  }, [jwt, setJwt]);

  return null;
}
