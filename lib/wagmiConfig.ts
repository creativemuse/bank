import { createConfig, createStorage, fallback, http, noopStorage } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { base, baseSepolia } from "wagmi/chains";

// Public RPC endpoints for Base - these are free and rate-limited
const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
const DEFAULT_BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";

// Additional public fallback endpoints
const BASE_PUBLIC_RPC_ENDPOINTS = [
  "https://base.gateway.tenderly.co",
  "https://base-rpc.publicnode.com",
  "https://1rpc.io/base",
  "https://base.meowrpc.com",
];

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

// Build Base Mainnet RPC endpoints with fallbacks
const buildBaseRpcEndpoints = () => {
  const endpoints = [];

  // 1. Custom Alchemy endpoint (if provided)
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (alchemyKey) {
    endpoints.push(
      http(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`, {
        batch: {
          wait: 50, // Wait 50ms before sending batch
        },
        retryCount: 3,
        retryDelay: 1000, // 1 second between retries
      })
    );
  }

  // 2. Custom RPC URL (if provided)
  const customRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL;
  if (customRpcUrl && customRpcUrl !== DEFAULT_BASE_RPC_URL) {
    endpoints.push(
      http(customRpcUrl, {
        batch: {
          wait: 50,
        },
        retryCount: 2,
      })
    );
  }

  // 3. Default Base public RPC
  endpoints.push(
    http(DEFAULT_BASE_RPC_URL, {
      batch: {
        wait: 50,
      },
      retryCount: 2,
    })
  );

  // 4. Additional public fallbacks (sample 2 random ones to avoid always hitting the same endpoint)
  const shuffledFallbacks = [...BASE_PUBLIC_RPC_ENDPOINTS].sort(() => Math.random() - 0.5);
  shuffledFallbacks.slice(0, 2).forEach((url) => {
    endpoints.push(
      http(url, {
        batch: {
          wait: 100, // Longer wait for public endpoints
        },
        retryCount: 1,
      })
    );
  });

  console.log(`[wagmiConfig] Configured ${endpoints.length} RPC endpoints for Base Mainnet`);
  
  return endpoints;
};

// Build Base Sepolia RPC endpoints
const buildBaseSepoliaRpcEndpoints = () => {
  const endpoints = [];

  // Alchemy Sepolia endpoint
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (alchemyKey) {
    endpoints.push(
      http(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`, {
        batch: { wait: 50 },
        retryCount: 3,
      })
    );
  }

  // Custom or default Sepolia RPC
  const sepoliaRpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? DEFAULT_BASE_SEPOLIA_RPC_URL;
  endpoints.push(
    http(sepoliaRpcUrl, {
      batch: { wait: 50 },
      retryCount: 2,
    })
  );

  return endpoints;
};

const transports = {
  [base.id]: fallback(buildBaseRpcEndpoints(), {
    rank: true, // Rank transports by speed
  }),
  [baseSepolia.id]: fallback(buildBaseSepoliaRpcEndpoints(), {
    rank: true,
  }),
};

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Only initialize WalletConnect in the browser to avoid SSR issues with indexedDB
const isBrowser = typeof window !== 'undefined';

const connectors = [
  injected({
    shimDisconnect: true,
  }),
  ...(walletConnectProjectId && isBrowser
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

