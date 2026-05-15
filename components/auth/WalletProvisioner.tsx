"use client";

import { useEffect, useRef } from "react";
import { useCrossmint, useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";
import { useWalletProvisioning } from "@/context/WalletProvisioningContext";

const WALLET_NOT_AVAILABLE_CODE = "wallet:wallet-not-available";

function isPasskeyGestureError(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("notallowederror") ||
    msg.includes("user gesture") ||
    msg.includes("user activation") ||
    msg.includes("request cancelled") ||
    msg.includes("the operation either timed out or was not allowed")
  );
}

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
  const { retryToken, setErrorMessage, setStage } = useWalletProvisioning();
  const inFlight = useRef(false);
  const getWalletRef = useRef(getWallet);
  const createWalletRef = useRef(createWallet);
  const lastKey = useRef<string | null>(null);

  // Keep function refs current without triggering effect re-runs
  getWalletRef.current = getWallet;
  createWalletRef.current = createWallet;

  useEffect(() => {
    // Only run when we have an active session but wallet hasn't loaded yet.
    if (status === "loaded" || status === "in-progress") return;
    if (!crossmint.jwt) return;
    if (inFlight.current) return;

    const email = user?.email ?? "";
    const key = `${crossmint.jwt}:${email}:${chain}:${retryToken}`;
    if (lastKey.current === key) return; // already attempted for this identity
    lastKey.current = key;

    setErrorMessage(null);
    setStage("idle");
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
            setErrorMessage("We need your email to set up wallet recovery. Please sign in with email OTP instead.");
            return;
          }

          // Passkey creation needs a recent user gesture. After an OAuth redirect,
          // there is no fresh gesture, so the first attempt will fail with a
          // NotAllowedError / user-gesture error. We surface this so the UI can
          // show a retry button (the click counts as a gesture on the 2nd try).
          setStage("passkey");
          try {
            await createWalletRef.current({
              chain,
              signers: [{ type: "passkey" }],
              recovery: { type: "email", email },
            });
          } catch (createErr: any) {
            console.error("[WalletProvisioner] Error creating wallet", createErr);

            if (isPasskeyGestureError(createErr)) {
              setErrorMessage(
                "Passkey setup needs a fresh interaction. Please tap 'Try again' below to retry."
              );
              return;
            }

            // If passkey fails for another reason, try email-only fallback.
            setStage("email-fallback");
            try {
              await createWalletRef.current({
                chain,
                signers: [{ type: "email" }],
                recovery: { type: "email", email },
              });
            } catch (fallbackErr: any) {
              console.error("[WalletProvisioner] Fallback email wallet creation also failed", fallbackErr);
              setErrorMessage(
                String(fallbackErr?.message ?? "Wallet creation failed. Please sign out and try again.")
              );
            }
          }
        } else {
          console.error("[WalletProvisioner] Unexpected error loading wallet", err);
          setErrorMessage(String(err?.message ?? "Something went wrong while provisioning your wallet."));
        }
      } finally {
        inFlight.current = false;
      }
    })();
  }, [status, user?.email, crossmint.jwt, chain, retryToken, setErrorMessage, setStage]);

  return null;
}
