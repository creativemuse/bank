"use client";

import { useState, useMemo } from "react";
import { Address, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { YearnVaultModal } from "@/components/yearn/YearnVaultModal";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
import { formatPercent } from "@/lib/formatters";
import { formatVaultShares } from "@/lib/yearnUtils";
import Link from "next/link";

// ERC-4626 ABI for reading vault data
const ERC4626_ABI = [
  {
    inputs: [],
    name: "totalAssets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "asset",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type DeployedVaultCardProps = {
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol?: string;
  assetDecimals?: number;
  name?: string;
  transactionHash?: string;
};

export const DeployedVaultCard = ({
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
  name,
  transactionHash,
}: DeployedVaultCardProps) => {
  const { address: userAddress } = useAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw">("deposit");

  // Get Aave reserve data for APR
  const { reserve, loading: reserveLoading } = useBaseUsdcReserve();

  // Get vault TVL from ERC-4626 totalAssets
  const { data: totalAssets, isLoading: vaultLoading } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "totalAssets",
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Get vault asset address
  const { data: vaultAssetAddress } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "asset",
  });

  // Get user's share balance
  const { data: shareBalance } = useReadContract({
    address: vaultAddress,
    abi: [
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Calculate user's asset value from shares
  const { data: convertToAssets } = useReadContract({
    address: vaultAddress,
    abi: [
      {
        inputs: [{ internalType: "uint256", name: "shares", type: "uint256" }],
        name: "convertToAssets",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "convertToAssets",
    args: shareBalance ? [shareBalance] : undefined,
    query: {
      enabled: !!shareBalance && shareBalance > 0n,
    },
  });

  // Use the actual asset address from vault if available
  const actualAssetAddress = (vaultAssetAddress || assetAddress) as Address;

  const handleOpenDeposit = () => {
    setModalMode("deposit");
    setModalOpen(true);
  };

  const handleOpenWithdraw = () => {
    setModalMode("withdraw");
    setModalOpen(true);
  };

  // Calculate APR from Aave reserve (after performance fee)
  const aprDisplay = useMemo(() => {
    if (reserveLoading || !reserve) return "Loading...";
    
    const supplyApy = reserve.supplyInfo.apy?.value;
    if (!supplyApy) return "—";
    
    // Aave vaults typically have a performance fee (e.g., 10-50%)
    // The APR shown should be the net APR after fees
    // For now, we'll show the underlying Aave APR
    // In the future, we could calculate net APR based on vault fees
    return formatPercent(supplyApy);
  }, [reserve, reserveLoading]);

  const tvlDisplay = vaultLoading
    ? "Loading..."
    : totalAssets
      ? `$${Number(formatUnits(totalAssets, assetDecimals)).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";

  const hasPosition = shareBalance && shareBalance > 0n;
  const positionValue = hasPosition && convertToAssets
    ? formatUnits(convertToAssets, assetDecimals)
    : "0";

  const displayName = name || `My Aave Vault`;

  return (
    <>
      <StrategyCard
        title={displayName}
        subtitle="Your deployed Aave USDC Earn Vault"
        apr={aprDisplay}
        tvl={tvlDisplay}
        description="Your custom ERC-4626 vault deployed on Base, sourcing yield from the Aave USDC reserve."
        actions={[
          {
            id: "deposit",
            label: hasPosition ? "Add Funds" : "Deposit",
            ariaLabel: "Deposit into vault",
            onClick: handleOpenDeposit,
          },
          ...(hasPosition
            ? [
                {
                  id: "withdraw",
                  label: "Withdraw",
                  ariaLabel: "Withdraw from vault",
                  onClick: handleOpenWithdraw,
                },
              ]
            : []),
          {
            id: "view-vault",
            label: "View on Basescan",
            ariaLabel: "View vault on Basescan",
            onClick: () =>
              window.open(
                `https://basescan.org/address/${vaultAddress}`,
                "_blank",
                "noopener,noreferrer",
              ),
          },
        ]}
        footnote={
          <div className="flex flex-col gap-1 text-xs text-slate-500">
            <div>
              <span className="font-semibold">Vault Address: </span>
              <Link
                href={`https://basescan.org/address/${vaultAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline break-all"
              >
                {vaultAddress}
              </Link>
            </div>
            {transactionHash && (
              <div>
                <span className="font-semibold">Deployment TX: </span>
                <Link
                  href={`https://basescan.org/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {transactionHash.slice(0, 10)}...
                </Link>
              </div>
            )}
            {hasPosition && (
              <div className="mt-1 text-slate-600">
                Your Position: {Number(positionValue).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })} {assetSymbol} ({formatVaultShares(shareBalance)} shares)
              </div>
            )}
          </div>
        }
      />

      <YearnVaultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vaultAddress={vaultAddress}
        assetAddress={actualAssetAddress}
        assetSymbol={assetSymbol}
        mode={modalMode}
        userAssetBalance={0n} // Will be fetched by the modal
        assetDecimals={assetDecimals}
      />
    </>
  );
};

