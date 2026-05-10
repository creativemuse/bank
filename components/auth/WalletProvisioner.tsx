"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCrossmint, useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";

const WALLET_NOT_AVAILABLE_CODE = "wallet:wallet-not-available";

type SupportedChain = "base" | "base-sepolia";

/**
 * Loads or creates the user's Crossmint wallet after BYOA (Stytch) login.
 * Replaces `createOnLogin` on CrossmintWalletProvider because the recovery
 * email must be threaded from the authenticated Stytch user — which isn't
 * available at provider-mount time.
 *
 * Surfaces failures via a toast with a "Retry" action so users aren't
 * silently left without a wallet (a common cause of "Google login is broken /
 * sync issues" reports).
 */
export function WalletProvisioner({ chain }: { chain: SupportedChain }) {
  const { user, status: authStatus } = useAuth();
  const { crossmint } = useCrossmint();
  const { status, getWallet, createWallet } = useWallet();
  const inFlight = useRef(false);
  const lastErrorAt = useRef<number>(0);
  // Bumping this triggers a retry attempt.
  const [retryToken, setRetryToken] = useState(0);

  // Reset on logout so the next login can attempt provisioning again.
  useEffect(() => {
    if (authStatus !== "logged-in") {
      inFlight.current = false;
      lastErrorAt.current = 0;
    }
  }, [authStatus]);

  const provision = useCallback(async () => {
    if (!user?.email) return;
    inFlight.current = true;

    try {
      await getWallet({ chain });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === WALLET_NOT_AVAILABLE_CODE) {
        try {
          await createWallet({
            chain,
            signers: [{ type: "passkey" }],
            recovery: { type: "email", email: user.email },
          });
        } catch (createErr) {
          console.error("[WalletProvisioner] Error creating wallet", createErr);
          throw createErr;
        }
      } else {
        console.error("[WalletProvisioner] Unexpected error loading wallet", err);
        throw err;
      }
    } finally {
      inFlight.current = false;
    }
  }, [user?.email, chain, getWallet, createWallet]);

  useEffect(() => {
    if (authStatus !== "logged-in") return;
    if (!user?.email || !crossmint.jwt) return;
    if (status === "loaded" || status === "in-progress") return;
    if (inFlight.current) return;

    // For "error" status: only retry when the user explicitly requested it
    // (retryToken bumped) to avoid tight retry loops.
    if (status === "error" && retryToken === 0) return;

    void provision().catch((err) => {
      // Throttle toasts so we don't spam (e.g. on rapid re-renders).
      const now = Date.now();
      if (now - lastErrorAt.current < 5000) return;
      lastErrorAt.current = now;

      const message =
        (err as { message?: string } | null)?.message ||
        "We couldn't set up your wallet. Please try again.";

      toast.error(message, {
        description:
          "If this keeps happening, try signing out and signing back in, or use a different sign-in method.",
        duration: 10000,
        action: {
          label: "Retry",
          onClick: () => setRetryToken((t) => t + 1),
        },
      });
    });
  }, [authStatus, status, user?.email, crossmint.jwt, retryToken, provision]);

  return null;
}
