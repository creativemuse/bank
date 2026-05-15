"use client";

import { useEffect, useRef } from "react";
import { useCrossmint, useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";
import { useWalletProvisioning } from "@/context/WalletProvisioningContext";

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
 *
 * CRITICAL: `getWallet` from the Crossmint SDK swallows 404 errors internally
 * (returns `undefined` instead of throwing). Do NOT rely on try/catch — check
 * the return value. If `getWallet` returns a falsy value and status flips to
 * "error", the wallet doesn't exist yet and we should call `createWallet`.
 */
export function WalletProvisioner({ chain }: { chain: SupportedChain }) {
  const { user } = useAuth();
  const { crossmint } = useCrossmint();
  const { status, getWallet, createWallet } = useWallet();
  const { retryToken, setErrorMessage, setStage } = useWalletProvisioning();

  const inFlight = useRef(false);
  const getWalletRef = useRef(getWallet);
  const createWalletRef = useRef(createWallet);
  const hasAttemptedCreate = useRef(false);
  const lastRetryToken = useRef(0);

  // Stable refs for the latest functions without re-triggering the effect
  getWalletRef.current = getWallet;
  createWalletRef.current = createWallet;

  useEffect(() => {
    // Reset attempt-tracking when the user explicitly requests a retry
    if (retryToken !== lastRetryToken.current) {
      hasAttemptedCreate.current = false;
      lastRetryToken.current = retryToken;
    }

    if (status === "loaded" || status === "in-progress") return;
    if (!crossmint.jwt) return;
    if (inFlight.current) return;
    // Don't loop: one createWallet attempt per retryToken
    if (hasAttemptedCreate.current) return;

    const email = user?.email ?? "";
    inFlight.current = true;
    setErrorMessage(null);
    setStage("idle");

    (async () => {
      try {
        console.warn("[WalletProvisioner] Calling getWallet...");
        // getWallet returns the wallet object when found, or undefined when
        // not found (404 is caught internally and status becomes "error").
        const wallet = await getWalletRef.current({ chain });

        if (wallet) {
          console.warn("[WalletProvisioner] Wallet already exists.", wallet.address);
          return;
        }

        // getWallet returned undefined → wallet does not exist for this identity
        console.warn("[WalletProvisioner] Wallet not found. Proceeding to createWallet.");

        if (!email) {
          console.warn("[WalletProvisioner] No email for recovery.");
          setErrorMessage(
            "We need your email to set up wallet recovery. Please sign in with email OTP instead."
          );
          return;
        }

        hasAttemptedCreate.current = true;
        setStage("passkey");

        try {
          console.warn("[WalletProvisioner] Attempting createWallet with passkey...");
          await createWalletRef.current({
            chain,
            signers: [{ type: "passkey" }],
            recovery: { type: "email", email },
          });
          console.warn("[WalletProvisioner] createWallet (passkey) succeeded!");
        } catch (createErr: any) {
          console.error("[WalletProvisioner] createWallet (passkey) FAILED:", createErr);

          // Passkey creation requires a recent user gesture. After an OAuth
          // redirect there is no gesture, so the first attempt fails with a
          // NotAllowedError. We surface this so the user can tap "Try again",
          // and the click itself becomes the required gesture.
          if (isPasskeyGestureError(createErr)) {
            setErrorMessage(
              "Passkey setup needs a fresh interaction. Please tap 'Try again' below to retry."
            );
            hasAttemptedCreate.current = false; // allow retry
            return;
          }

          // For any other passkey failure, fall back to an email-only signer
          console.warn("[WalletProvisioner] Passkey failed, trying email fallback...");
          setStage("email-fallback");
          try {
            await createWalletRef.current({
              chain,
              signers: [{ type: "email" }],
              recovery: { type: "email", email },
            });
            console.warn("[WalletProvisioner] createWallet (email fallback) succeeded!");
          } catch (fallbackErr: any) {
            console.error("[WalletProvisioner] Fallback email wallet creation also FAILED:", fallbackErr);
            setErrorMessage(
              String(fallbackErr?.message ?? "Wallet creation failed. Please sign out and try again.")
            );
          }
        }
      } catch (unexpectedErr: any) {
        // getWallet shouldn't throw, but guard defensively
        console.error("[WalletProvisioner] Unexpected error:", unexpectedErr);
        setErrorMessage(
          String(unexpectedErr?.message ?? "Something went wrong while provisioning your wallet.")
        );
      } finally {
        inFlight.current = false;
        console.warn("[WalletProvisioner] Done. inFlight cleared.");
      }
    })();
  }, [status, user?.email, crossmint.jwt, chain, retryToken, setErrorMessage, setStage]);

  return null;
}
