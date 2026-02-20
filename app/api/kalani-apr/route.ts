import { NextResponse } from "next/server";
import { base } from "viem/chains";
import { Address, createPublicClient, fallback, http } from "viem";

import { KALANI_VAULT_ADDRESSES } from "@/lib/config/kalani";

const KALANI_ORACLE_ABI = [
  {
    inputs: [{ internalType: "address", name: "_vault", type: "address" }],
    name: "getCurrentApr",
    outputs: [{ internalType: "uint256", name: "apr", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ROLE_MANAGER_ABI = [
  {
    inputs: [],
    name: "getAllVaults",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const defaultRpcUrl = "https://mainnet.base.org";
const configuredRpcUrl =
  process.env.KALANI_BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL ?? defaultRpcUrl;

const transports = [
  http(configuredRpcUrl),
  ...(configuredRpcUrl === defaultRpcUrl ? [] : [http(defaultRpcUrl)]),
];

const publicClient = createPublicClient({
  chain: base,
  transport: fallback(transports),
});

let cachedVaultAddress: Address | undefined;

const resolveVaultAddress = async (): Promise<Address> => {
  if (cachedVaultAddress) {
    return cachedVaultAddress;
  }

  // KALANI_VAULT_ADDRESS (server) or NEXT_PUBLIC_KALANI_VAULT_ADDRESS (e.g. Yearn USDC vault)
  const configured =
    process.env.KALANI_VAULT_ADDRESS ??
    process.env.NEXT_PUBLIC_KALANI_VAULT_ADDRESS;
  if (configured) {
    cachedVaultAddress = configured as Address;
    return cachedVaultAddress;
  }

  try {
    const vaults = (await publicClient.readContract({
      abi: ROLE_MANAGER_ABI,
      address: KALANI_VAULT_ADDRESSES.roleManager,
      functionName: "getAllVaults",
    })) as Address[];

    if (vaults.length === 0) {
      throw new Error("Role manager returned no vaults.");
    }

    cachedVaultAddress = vaults[0];
    return cachedVaultAddress;
  } catch (error) {
    console.error("Kalani vault discovery failed", error);
    throw error;
  }
};

const normalizeApr = (rawApr: bigint | number | string) => {
  if (typeof rawApr === "bigint") {
    return Number(rawApr) / 1e18;
  }

  if (typeof rawApr === "number") {
    return rawApr;
  }

  const parsed = Number.parseFloat(rawApr);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
};

export const GET = async () => {
  try {
    const vaultAddress = await resolveVaultAddress();

    const rawApr = await publicClient.readContract({
      abi: KALANI_ORACLE_ABI,
      address: KALANI_VAULT_ADDRESSES.aprOracle as Address,
      functionName: "getCurrentApr",
      args: [vaultAddress],
    });

    const aprValue = normalizeApr(rawApr);

    if (typeof aprValue === "undefined") {
      return NextResponse.json(
        { error: "APR oracle returned an invalid value." },
        { status: 502 },
      );
    }

    return NextResponse.json({ aprPercent: aprValue * 100 });
  } catch (error) {
    console.error("Kalani APR oracle fetch failed", error);

    if (error && typeof error === "object" && "shortMessage" in error && typeof error.shortMessage === "string") {
      return NextResponse.json({ error: error.shortMessage }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Unable to fetch Kalani APR at this time.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
};


