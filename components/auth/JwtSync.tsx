"use client";

import { useEffect } from "react";
import { useStytch } from "@stytch/nextjs";
import { useCrossmint } from "@crossmint/client-sdk-react-ui";

/**
 * Bridges the Stytch session JWT into Crossmint for BYOA wallet operations.
 */
export const JwtSync = () => {
  const stytch = useStytch();
  const { setJwt } = useCrossmint();

  useEffect(() => {
    const syncJwt = () => {
      const nextJwt = stytch.session.getTokens()?.session_jwt ?? undefined;
      setJwt(nextJwt);
    };

    syncJwt();
    return stytch.session.onChange(syncJwt);
  }, [stytch, setJwt]);

  return null;
};
