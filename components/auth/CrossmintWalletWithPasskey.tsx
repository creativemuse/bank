"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CrossmintWalletProvider } from "@crossmint/client-sdk-react-ui";
import { shouldSkipPasskey } from "@/lib/passkeySupport";

type ValidChain = "base" | "base-sepolia";

type CreateOnLoginConfig = {
  chain: ValidChain;
  signers: Array<{ type: "passkey" } | { type: "email" }>;
  recovery: { type: "email" };
};

type CrossmintWalletWithPasskeyProps = {
  chain: ValidChain;
  children: ReactNode;
};

export const CrossmintWalletWithPasskey = ({
  chain,
  children,
}: CrossmintWalletWithPasskeyProps) => {
  const [createOnLogin, setCreateOnLogin] = useState<CreateOnLoginConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolveConfig = async () => {
      const skipPasskey = await shouldSkipPasskey();
      if (cancelled) return;

      setCreateOnLogin({
        chain,
        signers: skipPasskey ? [{ type: "email" }] : [{ type: "passkey" }],
        recovery: { type: "email" },
      });
    };

    void resolveConfig();

    return () => {
      cancelled = true;
    };
  }, [chain]);

  if (!createOnLogin) {
    return null;
  }

  const usesPasskey = createOnLogin.signers[0]?.type === "passkey";

  return (
    <CrossmintWalletProvider showPasskeyHelpers={usesPasskey} createOnLogin={createOnLogin}>
      {children}
    </CrossmintWalletProvider>
  );
};
