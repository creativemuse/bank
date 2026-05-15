"use client";

import { useEffect, useRef } from "react";
import { useCrossmint, useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";

const WALLET_NOT_AVAILABLE_CODE = "wallet:wallet-not-available";

type SupportedChain = "base" | "base-sepolia";

/**
 * Loads or creates the user's Crossmint wallet after BYOA (Stytch) login.
 * Replaces `createOnLogin` on CrossmintWalletProvider because the recovery
 * email must be threaded from the authenticated Stytch user — which isn't
 * available at provider-mount time.
 */
export function WalletProvisioner({ chain }: { chain: SupportedChain }) {
  const { user } = useAuth();
  const { crossmint } = useCrossmint();
  const { status, getWallet, createWallet } = useWallet();
  const inFlight = useRef(false);

  useEffect(() => {
    if (status === "loaded" || status === "in-progress") return;
    if (!crossmint.jwt) return;
    if (inFlight.current) return;

    const email = user?.email ?? "";
    inFlight.current = true;

    (async () => {
      try {
        await getWallet({ chain });
      } catch (err: any) {
        // Crossmint getWallet throws when the wallet doesn't exist yet.
        // The error shape varies by SDK version (404, wallet:wallet-not-available, etc.)
        const isNotFound =
          err?.code === WALLET_NOT_AVAILABLE_CODE ||
          err?.message?.includes("notFound") ||
          err?.status === 404;

        if (isNotFound) {
          if (!email) {
            console.warn("[WalletProvisioner] No email available for recovery; deferring wallet creation.");
            inFlight.current = false;
            return;
          }
          try {
            await createWallet({
              chain,
              signers: [{ type: "passkey" }],
              recovery: { type: "email", email },
            });
          } catch (createErr) {
            console.error("[WalletProvisioner] Error creating wallet", createErr);
          }
        } else {
          console.error("[WalletProvisioner] Unexpected error loading wallet", err);
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [status, user?.email, crossmint.jwt, chain, getWallet, createWallet]);

  return null;
}
