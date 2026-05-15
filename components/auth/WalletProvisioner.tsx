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
  const getWalletRef = useRef(getWallet);
  const createWalletRef = useRef(createWallet);
  const lastKey = useRef<string | null>(null);

  // Keep function refs current without triggering effect re-runs
  getWalletRef.current = getWallet;
  createWalletRef.current = createWallet;

  useEffect(() => {
    if (status === "loaded" || status === "in-progress") return;
    if (!crossmint.jwt) return;
    if (inFlight.current) return;

    const email = user?.email ?? "";
    const key = `${crossmint.jwt}:${email}:${chain}`;
    if (lastKey.current === key) return; // already attempted for this identity
    lastKey.current = key;

    inFlight.current = true;

    (async () => {
      try {
        await getWalletRef.current({ chain });
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
            return;
          }
          try {
            await createWalletRef.current({
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
  }, [status, user?.email, crossmint.jwt, chain]);

  return null;
}
