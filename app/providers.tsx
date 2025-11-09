"use client";

import {
  CrossmintProvider,
  CrossmintAuthProvider,
  CrossmintWalletProvider,
} from "@crossmint/client-sdk-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { AaveProvider, AaveClient, production } from "@aave/react";

import { wagmiConfig } from "@/lib/wagmiConfig";
import { MembershipProvider } from "@/context/MembershipContext";

const aaveClient = AaveClient.create({
  environment: production,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

const walletConnectMissing =
  !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID &&
  process.env.NODE_ENV !== "production";

if (walletConnectMissing) {
  console.warn(
    "⚠️ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect will be disabled.",
  );
}

if (!process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY) {
  throw new Error("NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY is not set");
}

// Supported chains: base (mainnet) and base-sepolia (testnet)
const VALID_CHAINS = ["base", "base-sepolia"] as const;
type ValidChain = (typeof VALID_CHAINS)[number];

const isProduction = process.env.NODE_ENV === "production";
const configuredChain = process.env.NEXT_PUBLIC_CHAIN_ID;

// Determine the chain based on environment
let chain: ValidChain;

if (isProduction) {
  // In production, force Base mainnet
  if (configuredChain === "base-sepolia") {
    console.warn("⚠️ Base Sepolia detected in production. Forcing Base mainnet.");
  }
  chain = "base";
} else {
  // In development, use configured chain or default to base-sepolia
  chain = VALID_CHAINS.includes(configuredChain as ValidChain)
    ? (configuredChain as ValidChain)
    : "base-sepolia";
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AaveProvider client={aaveClient}>
          <MembershipProvider>
            <CrossmintProvider
              apiKey={process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY || ""}
            >
              <CrossmintAuthProvider
                authModalTitle="Welcome to CREATIVE Bank"
                loginMethods={["email", "google"]}
                termsOfServiceText={
                  <p>
                    By continuing, you accept the{" "}
                    <a href="https://www.crossmint.com/legal/terms-of-service" target="_blank">
                      Wallet&apos;s Terms of Service
                    </a>
                    , and to recieve marketing communications from Creative Org DAO.
                  </p>
                }
              >
                <CrossmintWalletProvider
                  showPasskeyHelpers={true}
                  createOnLogin={{
                    chain,
                    signer: { type: "passkey" },
                  }}
                >
                  {children}
                </CrossmintWalletProvider>
              </CrossmintAuthProvider>
            </CrossmintProvider>
          </MembershipProvider>
        </AaveProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
