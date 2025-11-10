import { Web3Service } from "@unlock-protocol/unlock-js";
import { Address } from "viem";

import { MEMBERSHIP_LOCKS, MembershipTier } from "@/lib/config/memberships";
import {
  unlockAddress,
  unlockChainId,
  unlockProviderUrl,
} from "@/lib/config/unlock";

type UnlockNetworkConfig = Record<
  number,
  {
    unlockAddress: string;
    provider: string;
  }
>;

export type UnlockMembershipState = {
  hasValidKey: boolean;
  expiresAtMs: number | null;
  error?: string;
};

const networkConfig: UnlockNetworkConfig = {
  [unlockChainId]: {
    unlockAddress,
    provider: unlockProviderUrl,
  },
};

let cachedService: Web3Service | null = null;

const getWeb3Service = () => {
  if (!cachedService) {
    cachedService = new Web3Service(networkConfig);
  }

  return cachedService;
};

const parseMembershipState = (key: unknown): UnlockMembershipState => {
  console.log("[unlockMemberships] Parsing key:", key);

  if (!key || typeof key !== "object") {
    console.log("[unlockMemberships] Key is null or not an object");
    return { hasValidKey: false, expiresAtMs: null };
  }

  const keyRecord = key as Record<string, unknown>;
  const expirationValue = keyRecord.expiration ?? keyRecord.expirationTimestamp;
  const validValue = keyRecord.valid ?? keyRecord.hasValidKey;

  console.log("[unlockMemberships] expirationValue:", expirationValue, "validValue:", validValue);

  const expirationInSeconds =
    typeof expirationValue === "string"
      ? Number(expirationValue)
      : typeof expirationValue === "number"
      ? expirationValue
      : typeof expirationValue === "bigint"
      ? Number(expirationValue)
      : null;

  const expiresAtMs =
    typeof expirationInSeconds === "number" && Number.isFinite(expirationInSeconds)
      ? expirationInSeconds * 1000
      : null;

  console.log("[unlockMemberships] expiresAtMs:", expiresAtMs, "now:", Date.now(), "isValid:", expiresAtMs && expiresAtMs > Date.now());

  if (typeof validValue === "boolean") {
    console.log("[unlockMemberships] Using explicit validValue:", validValue);
    return { hasValidKey: validValue, expiresAtMs };
  }

  if (expiresAtMs && expiresAtMs > Date.now()) {
    console.log("[unlockMemberships] Key is valid based on expiration");
    return { hasValidKey: true, expiresAtMs };
  }

  console.log("[unlockMemberships] Key is not valid");
  return { hasValidKey: false, expiresAtMs: null };
};

const createEmptyState = () =>
  MEMBERSHIP_LOCKS.reduce<Record<MembershipTier, UnlockMembershipState>>(
    (accumulator, membershipLock) => {
      accumulator[membershipLock.tier] = {
        hasValidKey: false,
        expiresAtMs: null,
      };
      return accumulator;
    },
    {} as Record<MembershipTier, UnlockMembershipState>,
  );

export const fetchUnlockMembershipStates = async (walletAddress: Address) => {
  console.log("[unlockMemberships] Fetching memberships for wallet:", walletAddress);
  console.log("[unlockMemberships] Network config:", networkConfig);

  const service = getWeb3Service();

  const results = await Promise.all(
    MEMBERSHIP_LOCKS.map(async (lock) => {
      console.log("[unlockMemberships] Checking lock:", lock.tier, lock.address);
      try {
        const key = await service.getKeyByLockForOwner(
          lock.address,
          walletAddress,
          unlockChainId,
        );

        console.log("[unlockMemberships] Received key for", lock.tier, ":", key);

        const state = parseMembershipState(key);

        console.log("[unlockMemberships] Parsed state for", lock.tier, ":", state);

        return { lock, state };
      } catch (error) {
        console.error("[unlockMemberships] Failed to fetch membership via Unlock", lock.address, error);
        return {
          lock,
          state: {
            hasValidKey: false,
            expiresAtMs: null,
            error:
              error instanceof Error ? error.message : "Failed to fetch membership",
          } satisfies UnlockMembershipState,
        };
      }
    }),
  );

  const finalState = results.reduce<Record<MembershipTier, UnlockMembershipState>>(
    (accumulator, result) => {
      accumulator[result.lock.tier] = result.state;
      return accumulator;
    },
    createEmptyState(),
  );

  console.log("[unlockMemberships] Final membership states:", finalState);

  return finalState;
};

