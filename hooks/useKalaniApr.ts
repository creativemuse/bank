import { useCallback, useEffect, useState } from "react";
import { Address } from "viem";
import { usePublicClient } from "wagmi";

import { isBaseMainnet } from "@/lib/wagmiConfig";
import { KALANI_VAULT_ADDRESSES } from "@/lib/config/kalani";

const KALANI_ORACLE_ABI = [
  {
    inputs: [],
    name: "latestAnswer",
    outputs: [{ internalType: "int256", name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type KalaniAprState = {
  loading: boolean;
  aprPercent?: number;
  error?: string;
};

export function useKalaniApr() {
  const [state, setState] = useState<KalaniAprState>({ loading: true });
  const publicClient = usePublicClient({
    chainId: isBaseMainnet ? 8453 : 84532,
  });

  const fetchApr = useCallback(async () => {
    if (!isBaseMainnet) {
      setState({
        loading: false,
        error: "APR oracle available on Base mainnet only.",
      });
      return;
    }

    if (!publicClient) {
      setState({ loading: true });
      return;
    }

    setState({ loading: true });

    try {
      const raw = await publicClient.readContract({
        abi: KALANI_ORACLE_ABI,
        address: KALANI_VAULT_ADDRESSES.aprOracle as Address,
        functionName: "latestAnswer",
      });

      const value =
        typeof raw === "bigint"
          ? Number(raw) / 1e18
          : typeof raw === "number"
            ? raw
            : Number.parseFloat(String(raw));

      if (Number.isNaN(value)) {
        setState({ loading: false, error: "APR oracle returned an invalid value." });
        return;
      }

      setState({
        loading: false,
        aprPercent: value * 100,
      });
    } catch (error) {
      console.error("Kalani APR oracle read failed", error);
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown oracle error",
      });
    }
  }, [publicClient]);

  useEffect(() => {
    void fetchApr();
  }, [fetchApr]);

  return {
    apr: state.aprPercent,
    loading: state.loading,
    error: state.error,
    refetch: fetchApr,
  };
}

