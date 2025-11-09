import { Address } from "viem";

export type MembershipTier = "Creative Brand" | "Creative Investor" | "Creative Creator";

export type MembershipLock = {
  tier: MembershipTier;
  address: Address;
  priority: number;
};

export const MEMBERSHIP_LOCKS: MembershipLock[] = [
  {
    tier: "Creative Brand",
    address: "0x9c3744c96200a52d05a630d4aec0db707d7509be",
    priority: 3,
  },
  {
    tier: "Creative Investor",
    address: "0x13b818daf7016b302383737ba60c3a39fef231cf",
    priority: 2,
  },
  {
    tier: "Creative Creator",
    address: "0xf7c4cd399395d80f9d61fde833849106775269c6",
    priority: 1,
  },
];

export const MEMBERSHIP_CHECKSUM = MEMBERSHIP_LOCKS.reduce<Record<Address, MembershipTier>>(
  (accumulator, lock) => {
    accumulator[lock.address] = lock.tier;
    return accumulator;
  },
  {},
);

