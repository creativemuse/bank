"use client";

import { useEffect, useState } from "react";
import { CrossmintProvider, CrossmintWalletProvider } from "@crossmint/client-sdk-react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";
import { AaveProvider, AaveClient, production } from "@aave/react";
import { StytchProvider } from "@stytch/nextjs";

import { wagmiConfig } from "@/lib/wagmiConfig";
import { MembershipProvider } from "@/context/MembershipContext";
import { AuthProvider } from "@/context/AuthContext";
import { JwtSync } from "@/components/auth/JwtSync";
import { getStytchHeadlessClient } from "@/lib/stytchClient";

const aaveClient = AaveClient.create({
  environment: {
    ...production,
    backend: "/api/aave/graphql",
  },
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
  !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && process.env.NODE_ENV !== "production";

if (walletConnectMissing) {
  console.warn(
    "⚠️ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect will be disabled."
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

const stytchClient = getStytchHeadlessClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Suppress unhandled InvariantError from the Aave SDK's internal useVaults hook.
    // Their GraphQL service intermittently panics and throws an uncatchable promise
    // rejection. We handle the user-facing impact in VaultManagementModal; this just
    // prevents the console noise.
    const handler = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? "");
      if (msg.includes("Service panicked") || msg.includes("InvariantError")) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <AaveProvider client={aaveClient}>
          <StytchProvider stytch={stytchClient}>
            <AuthProvider>
              <CrossmintProvider apiKey={process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY || ""}>
                <CrossmintWalletProvider
                  showPasskeyHelpers={true}
                  createOnLogin={{
                    chain,
                    recovery: { type: "email" },
                  }}
                >
                  <JwtSync />
                  <MembershipProvider>
                    {children}
                    <Toaster richColors position="top-center" closeButton />
                  </MembershipProvider>
                </CrossmintWalletProvider>
              </CrossmintProvider>
            </AuthProvider>
          </StytchProvider>
        </AaveProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
