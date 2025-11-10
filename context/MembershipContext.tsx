"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";

import {
  MEMBERSHIP_LOCKS,
  MembershipLock,
  MembershipTier,
} from "@/lib/config/memberships";
import { appChain } from "@/lib/wagmiConfig";
import { unlockChainId } from "@/lib/config/unlock";

type MembershipLockState = {
  hasValidKey: boolean;
  expiresAtMs: number | null;
  error?: string;
};

type MembershipContextValue = {
  tier: MembershipTier | null;
  isLoading: boolean;
  locks: Record<MembershipTier, MembershipLockState>;
  refresh: () => Promise<void>;
};

const defaultState: MembershipContextValue = {
  tier: null,
  isLoading: true,
  locks: {
    "Creative Brand": { hasValidKey: false, expiresAtMs: null },
    "Creative Investor": { hasValidKey: false, expiresAtMs: null },
    "Creative Creator": { hasValidKey: false, expiresAtMs: null },
  },
  refresh: async () => undefined,
};

const MembershipContext = createContext<MembershipContextValue>(defaultState);

const PUBLIC_LOCK_ABI = [
  {
    inputs: [{ internalType: "address", name: "_keyOwner", type: "address" }],
    name: "getHasValidKey",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_keyOwner", type: "address" }],
    name: "keyExpirationTimestampFor",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const initialLockState = MEMBERSHIP_LOCKS.reduce<Record<MembershipTier, MembershipLockState>>(
  (accumulator, lock) => {
    accumulator[lock.tier] = { hasValidKey: false, expiresAtMs: null };
    return accumulator;
  },
  {
    "Creative Brand": { hasValidKey: false, expiresAtMs: null },
    "Creative Investor": { hasValidKey: false, expiresAtMs: null },
    "Creative Creator": { hasValidKey: false, expiresAtMs: null },
  },
);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const { wallet, status: walletStatus } = useWallet();
  const { status: authStatus } = useAuth();
  const publicClient = usePublicClient({ chainId: unlockChainId });
  const [state, setState] = useState<Omit<MembershipContextValue, "refresh">>({
    tier: null,
    isLoading: true,
    locks: initialLockState,
  });
  const currentAddressRef = useRef<Address | null>(null);

  const activeAddress = useMemo(() => {
    if (wallet && authStatus === "logged-in" && walletStatus !== "in-progress" && wallet.address) {
      return wallet.address as Address;
    }

    if (address) {
      return address;
    }

    return null;
  }, [address, authStatus, wallet, walletStatus]);

  const applyResults = useCallback(
    (locks: Record<MembershipTier, MembershipLockState>) => {
      const sorted = MEMBERSHIP_LOCKS.filter((lock) => locks[lock.tier]?.hasValidKey).sort(
        (a, b) => b.priority - a.priority,
      );
      const tier = sorted.length > 0 ? sorted[0].tier : null;

      setState({
        tier,
        isLoading: false,
        locks,
      });
    },
    [],
  );

  const resetState = useCallback(() => {
    setState({
      tier: null,
      isLoading: false,
      locks: initialLockState,
    });
  }, []);

  const evaluateLock = useCallback(
    async (lock: MembershipLock, walletAddress: Address) => {
      if (!publicClient) {
        return {
          lock,
          state: {
            hasValidKey: false,
            expiresAtMs: null,
            error: "Missing public client",
          } satisfies MembershipLockState,
        };
      }

      try {
        const hasValidKey = await publicClient.readContract({
          abi: PUBLIC_LOCK_ABI,
          address: lock.address,
          functionName: "getHasValidKey",
          args: [walletAddress],
        });

        if (!hasValidKey) {
          return {
            lock,
            state: {
              hasValidKey: false,
              expiresAtMs: null,
            },
          };
        }

        let expiresAtMs: number | null = null;

        try {
          const expiry = await publicClient.readContract({
            abi: PUBLIC_LOCK_ABI,
            address: lock.address,
            functionName: "keyExpirationTimestampFor",
            args: [walletAddress],
          });

          expiresAtMs =
            typeof expiry === "bigint"
              ? Number(expiry) * 1000
              : typeof expiry === "number"
                ? expiry * 1000
                : null;
        } catch (expiryError) {
          console.warn(
            "Unlock membership expiry lookup failed; continuing without expiry",
            lock.address,
            expiryError,
          );
        }

        return {
          lock,
          state: {
            hasValidKey: true,
            expiresAtMs,
          },
        };
      } catch (error) {
        console.error("Unlock membership check failed", lock.address, error);
        return {
          lock,
          state: {
            hasValidKey: false,
            expiresAtMs: null,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    },
    [publicClient],
  );

  const refresh = useCallback(async () => {
    if (!activeAddress) {
      resetState();
      return;
    }

    if (!publicClient) {
      setState((previous) => ({
        ...previous,
        isLoading: true,
      }));
      return;
    }

    setState((previous) => ({
      ...previous,
      isLoading: true,
    }));

    const walletAddress = activeAddress;
    currentAddressRef.current = walletAddress;

    const results = await Promise.all(
      MEMBERSHIP_LOCKS.map(async (lock) => evaluateLock(lock, walletAddress)),
    );

    if (currentAddressRef.current !== walletAddress) {
      return;
    }

    const locksState = results.reduce<Record<MembershipTier, MembershipLockState>>(
      (accumulator, result) => {
        accumulator[result.lock.tier] = result.state;
        return accumulator;
      },
      { ...initialLockState },
    );

    applyResults(locksState);
  }, [activeAddress, evaluateLock, applyResults, publicClient, resetState]);

  useEffect(() => {
    void refresh();

    if (typeof window === "undefined") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      tier: state.tier,
      isLoading: state.isLoading,
      locks: state.locks,
      refresh,
    }),
    [state, refresh],
  );

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  return useContext(MembershipContext);
}

