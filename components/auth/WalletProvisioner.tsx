"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCrossmint, useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";
import { useWalletProvisioning } from "@/context/WalletProvisioningContext";
import { isPasskeyCreationFailure, shouldSkipPasskey } from "@/lib/passkeySupport";

const WALLET_NOT_AVAILABLE_CODE = "wallet:wallet-not-available";

type SupportedChain = "base" | "base-sepolia";

/**
 * Loads or creates the user's Crossmint wallet after BYOA (Stytch) login.
 *
 * Signer strategy:
 *   1. Try a passkey signer (best UX after creation).
 *   2. If WebAuthn is unavailable (in-app browser / unsupported environment)
 *      OR passkey creation fails with a WebAuthn-style error, fall back to
 *      an email signer. The user already verified their email via Stytch,
 *      so an email-OTP signer is a natural fit and works in environments
 *      that block WebAuthn (Gmail / Facebook / Instagram / TikTok webviews).
 *
 * Errors and retry are surfaced through `WalletProvisioningContext` so the
 * shell UI can render a meaningful "Try again" affordance instead of a
 * dead-end "Sign out" screen.
 */
export function WalletProvisioner({ chain }: { chain: SupportedChain }) {
  const { user, status: authStatus } = useAuth();
  const { crossmint } = useCrossmint();
  const { status, getWallet, createWallet } = useWallet();
  const { retryToken, setErrorMessage, setStage } = useWalletProvisioning();
  const inFlight = useRef(false);
  const lastAttemptToken = useRef<number>(-1);

  // Reset on logout so the next login can attempt provisioning again.
  useEffect(() => {
    if (authStatus !== "logged-in") {
      inFlight.current = false;
      lastAttemptToken.current = -1;
      setErrorMessage(null);
      setStage("idle");
    }
  }, [authStatus, setErrorMessage, setStage]);

  const provision = useCallback(async () => {
    if (!user?.email) return;
    const email = user.email;
    inFlight.current = true;

    try {
      // Try to load an existing wallet first; fall through to creation only
      // if it doesn't exist yet.
      try {
        await getWallet({ chain });
        setErrorMessage(null);
        return;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code !== WALLET_NOT_AVAILABLE_CODE) throw err;
      }

      const skipPasskey = await shouldSkipPasskey();

      if (!skipPasskey) {
        try {
          setStage("passkey");
          await createWallet({
            chain,
            signers: [{ type: "passkey" }],
            recovery: { type: "email", email },
          });
          setErrorMessage(null);
          return;
        } catch (passkeyErr) {
          if (!isPasskeyCreationFailure(passkeyErr)) {
            throw passkeyErr;
          }
          console.warn(
            "[WalletProvisioner] Passkey creation failed; falling back to email signer.",
            passkeyErr
          );
        }
      }

      setStage("email-fallback");
      await createWallet({
        chain,
        signers: [{ type: "email", email }],
        recovery: { type: "email", email },
      });
      setErrorMessage(null);
    } finally {
      inFlight.current = false;
    }
  }, [user?.email, chain, getWallet, createWallet, setErrorMessage, setStage]);

  useEffect(() => {
    if (authStatus !== "logged-in") return;
    if (!user?.email || !crossmint.jwt) return;
    if (status === "loaded" || status === "in-progress") return;
    if (inFlight.current) return;

    // Run exactly once per retryToken value. Initial token is 0; ref starts at
    // -1 so the first effect runs, and subsequent runs only happen after the
    // UI bumps the token via requestRetry().
    if (retryToken === lastAttemptToken.current) return;

    lastAttemptToken.current = retryToken;
    void provision().catch((err) => {
      const message =
        (err as { message?: string } | null)?.message ||
        "We couldn't set up your wallet. Please try again.";
      console.error("[WalletProvisioner] Provisioning failed", err);
      // The in-app browser hint is rendered once by the shell (home.tsx); keep
      // this message focused on the technical failure to avoid duplication.
      setErrorMessage(message);
    });
  }, [authStatus, status, user?.email, crossmint.jwt, retryToken, provision, setErrorMessage]);

  return null;
}
