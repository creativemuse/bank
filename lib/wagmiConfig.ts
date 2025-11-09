import { createConfig, createStorage, fallback, http, noopStorage } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { base, baseSepolia } from "wagmi/chains";

const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
const DEFAULT_BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";

const isProduction = process.env.NODE_ENV === "production";
const configuredChain = process.env.NEXT_PUBLIC_CHAIN_ID;

export const appChain = (() => {
  if (isProduction) {
    return base;
  }

  if (configuredChain === "base" || configuredChain === "base-mainnet") {
    return base;
  }

  return baseSepolia;
})();

const transports = {
  [base.id]: fallback([
    http(process.env.NEXT_PUBLIC_BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL),
  ]),
  [baseSepolia.id]: fallback([
    http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? DEFAULT_BASE_SEPOLIA_RPC_URL),
  ]),
};

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors = [
  injected({
    shimDisconnect: true,
  }),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: "Creative Bank",
            description: "Creative Bank DeFi access",
            url: "https://creativeplatform.xyz",
            icons: ["https://creativeplatform.xyz/icon.png"],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  transports,
  connectors,
  ssr: true,
  storage: createStorage({
    storage: noopStorage,
  }),
});

export const isBaseMainnet = appChain.id === base.id;

