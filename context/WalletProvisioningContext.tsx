"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type WalletProvisioningStage = "idle" | "passkey" | "email-fallback";

interface WalletProvisioningContextValue {
  /** Last error message surfaced by `WalletProvisioner`, if any. */
  errorMessage: string | null;
  /** Which signer strategy was last attempted. */
  stage: WalletProvisioningStage;
  /** Bumped by the UI to ask the provisioner to try again. */
  retryToken: number;
  /** Bump to request a fresh provisioning attempt. */
  requestRetry: () => void;
  /** Used by the provisioner to publish state. Internal. */
  setErrorMessage: (msg: string | null) => void;
  setStage: (stage: WalletProvisioningStage) => void;
}

const WalletProvisioningContext = createContext<WalletProvisioningContextValue | null>(null);

export function WalletProvisioningProvider({ children }: { children: ReactNode }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<WalletProvisioningStage>("idle");
  const [retryToken, setRetryToken] = useState(0);

  const requestRetry = useCallback(() => {
    setErrorMessage(null);
    setRetryToken((t) => t + 1);
  }, []);

  const value = useMemo<WalletProvisioningContextValue>(
    () => ({ errorMessage, stage, retryToken, requestRetry, setErrorMessage, setStage }),
    [errorMessage, stage, retryToken, requestRetry]
  );

  return (
    <WalletProvisioningContext.Provider value={value}>
      {children}
    </WalletProvisioningContext.Provider>
  );
}

export function useWalletProvisioning() {
  const ctx = useContext(WalletProvisioningContext);
  if (!ctx) {
    throw new Error("useWalletProvisioning must be used within a WalletProvisioningProvider");
  }
  return ctx;
}
