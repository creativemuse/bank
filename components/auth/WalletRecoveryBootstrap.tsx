"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";

/** Wallet methods added in Crossmint Wallets SDK V1 recovery flows. */
type RecoverableWallet = {
  needsRecovery?: () => boolean;
  recover?: () => Promise<void>;
};

/**
 * Runs preemptive wallet recovery after the Crossmint wallet loads so the first
 * transaction is not interrupted by an email OTP prompt (new device / cleared storage).
 */
export function WalletRecoveryBootstrap() {
  const { wallet, status } = useWallet();
  const recoveryAttempted = useRef(false);

  useEffect(() => {
    if (status !== "loaded" || !wallet || recoveryAttempted.current) return;

    const recoverable = wallet as RecoverableWallet;
    if (typeof recoverable.needsRecovery !== "function") return;

    recoveryAttempted.current = true;

    (async () => {
      try {
        if (!recoverable.needsRecovery?.()) return;
        await recoverable.recover?.();
        console.warn("[WalletRecoveryBootstrap] Wallet recovery completed.");
      } catch (err) {
        console.error("[WalletRecoveryBootstrap] Recovery failed:", err);
        recoveryAttempted.current = false;
      }
    })();
  }, [status, wallet]);

  return null;
}
