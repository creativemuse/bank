import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // wagmi 3's connectors barrel re-exports every connector unconditionally.
      // We only use `injected` and `walletConnect`, so alias the optional peer
      // deps for connectors we don't use to `false` to skip webpack resolution.
      accounts: false,
      "@metamask/connect-evm": false,
    };
    return config;
  },
};

export default withBotId(nextConfig);
