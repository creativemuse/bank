"use client";

import { useEffect } from "react";
import { useCrossmint } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";

/**
 * Bridges Stytch JWT → Crossmint via setJwt().
 * Renders nothing. Must be placed inside CrossmintWalletProvider.
 *
 * Depends on session ID (not just JWT string) to catch background
 * session refreshes and prevent auth "dead zones".
 */
export function JwtSync() {
  const { jwt } = useAuth();
  const { setJwt } = useCrossmint();

  useEffect(() => {
    if (jwt) {
      setJwt(jwt);
    }
  }, [jwt, setJwt]);

  return null;
}
