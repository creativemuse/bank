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

const buildCreateOnLoginConfig = (
  chain: ValidChain,
  skipPasskey: boolean
): CreateOnLoginConfig => ({
  chain,
  signers: skipPasskey ? [{ type: "email" }] : [{ type: "passkey" }],
  recovery: { type: "email" },
});

export const CrossmintWalletWithPasskey = ({
  chain,
  children,
}: CrossmintWalletWithPasskeyProps) => {
  const [createOnLogin, setCreateOnLogin] = useState<CreateOnLoginConfig | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolveConfig = async () => {
      setIsResolving(true);

      try {
        const skipPasskey = await shouldSkipPasskey();
        if (cancelled) return;
        setCreateOnLogin(buildCreateOnLoginConfig(chain, skipPasskey));
      } catch (error) {
        console.error("[CrossmintWallet] Passkey detection failed, using email signer:", error);
        if (cancelled) return;
        setCreateOnLogin(buildCreateOnLoginConfig(chain, true));
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    };

    void resolveConfig();

    return () => {
      cancelled = true;
    };
  }, [chain]);

  if (isResolving || !createOnLogin) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  const usesPasskey = createOnLogin.signers[0]?.type === "passkey";

  return (
    <CrossmintWalletProvider showPasskeyHelpers={usesPasskey} createOnLogin={createOnLogin}>
      {children}
    </CrossmintWalletProvider>
  );
};
