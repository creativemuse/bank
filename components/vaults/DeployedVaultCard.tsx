"use client";

import { useState, useMemo, useCallback } from "react";
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
  performanceFee?: number; // Performance fee in percentage (e.g., 12 for 12%)
};

export const DeployedVaultCard = ({
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
  name,
  transactionHash,
  performanceFee,
}: DeployedVaultCardProps) => {
  const { address: userAddress } = useAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw">("deposit");

  // Get Aave reserve data for APR and aToken address
  const { reserve, loading: reserveLoading } = useBaseUsdcReserve();
  const aTokenAddress = reserve?.aToken?.address as Address | undefined;

  // Get vault TVL from ERC-4626 totalAssets (this includes accrued interest)
  const { data: totalAssets, isLoading: vaultLoading } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "totalAssets",
    chainId: 8453, // Base mainnet
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds to see interest accrue
    },
  });

  // Get vault's aToken balance (shows the actual aToken amount held)
  const { data: aTokenBalance } = useReadContract({
    address: aTokenAddress,
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
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId: 8453, // Base mainnet
    query: {
      enabled: !!aTokenAddress && !!vaultAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Get vault asset address
  const { data: vaultAssetAddress } = useReadContract({
    address: vaultAddress,
    abi: ERC4626_ABI,
    functionName: "asset",
    chainId: 8453, // Base mainnet
  });

  // Get user's share balance
  const { data: shareBalance, isLoading: isShareBalanceLoading } = useReadContract({
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
    chainId: 8453, // Base mainnet
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
    chainId: 8453, // Base mainnet
    query: {
      enabled: !!shareBalance && shareBalance > 0n,
    },
  });

  // Use the actual asset address from vault if available
  const actualAssetAddress = (vaultAssetAddress || assetAddress) as Address;

  // Get user's asset balance (USDC balance for deposits)
  const { data: userAssetBalance, refetch: refetchAssetBalance } = useReadContract({
    address: actualAssetAddress,
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
    chainId: 8453, // Base mainnet
    query: {
      enabled: !!actualAssetAddress && !!userAddress,
      refetchInterval: 10000, // Refetch every 10 seconds to keep balance updated
    },
  });

  const handleOpenDeposit = useCallback(() => {
    setModalMode("deposit");
    setModalOpen(true);
    // Refetch balance when opening deposit modal to ensure accurate balance
    if (refetchAssetBalance) {
      refetchAssetBalance();
    }
  }, [refetchAssetBalance]);

  const handleOpenWithdraw = useCallback(() => {
    setModalMode("withdraw");
    setModalOpen(true);
  }, []);

  // Calculate net APR from Aave reserve (after performance fee)
  const aprDisplay = useMemo(() => {
    if (reserveLoading || !reserve) return "Loading...";
    
    const supplyApyValue = reserve.supplyInfo.apy?.value;
    if (!supplyApyValue) return "—";
    
    // Convert to number if it's a string
    const supplyApy = typeof supplyApyValue === "string" 
      ? Number.parseFloat(supplyApyValue) 
      : Number(supplyApyValue);
    
    if (Number.isNaN(supplyApy)) return "—";
    
    // If we have the performance fee, calculate net APR
    // Aave Labs takes 50% of the performance fee, so:
    // Net APR = Gross APR * (1 - (performanceFee / 2) / 100)
    // Example: 12% fee = 6% goes to Aave Labs, 6% to vault manager
    // Net APR = Gross APR * (1 - 0.06) = Gross APR * 0.94
    if (performanceFee !== undefined && performanceFee > 0) {
      // Convert percentage to decimal (e.g., 12% -> 0.12)
      const feeDecimal = performanceFee / 100;
      // Aave Labs takes 50% of the fee
      const aaveLabsFeeShare = feeDecimal / 2;
      // Net APR after fees
      const netApy = supplyApy * (1 - aaveLabsFeeShare);
      return formatPercent(netApy);
    }
    
    // If no performance fee available, show gross APR
    return formatPercent(supplyApy);
  }, [reserve, reserveLoading, performanceFee]);

  const tvlDisplay = vaultLoading
    ? "Loading..."
    : totalAssets
      ? `$${Number(formatUnits(totalAssets, assetDecimals)).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";

  // Calculate accrued interest
  // totalAssets already includes interest, but we can show the aToken balance for transparency
  const aTokenBalanceDisplay = useMemo(() => {
    if (!aTokenBalance || !aTokenAddress) return null;
    
    const balance = Number(formatUnits(aTokenBalance, assetDecimals));
    return balance.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }, [aTokenBalance, aTokenAddress, assetDecimals]);

  // Calculate interest accrued (difference between aToken balance and underlying)
  // Note: totalAssets already accounts for interest, but we can show the aToken amount
  const interestInfo = useMemo(() => {
    if (!totalAssets || !aTokenBalance) return null;
    
    // The aToken balance represents the claimable underlying amount (including interest)
    // totalAssets should match this, but we can show both for transparency
    const totalAssetsNum = Number(formatUnits(totalAssets, assetDecimals));
    const aTokenBalanceNum = Number(formatUnits(aTokenBalance, assetDecimals));
    
    // If there's a difference, it's likely due to rounding or the way Aave calculates
    // For now, we'll show the aToken balance as the "earning balance"
    return {
      aTokenBalance: aTokenBalanceNum,
      totalAssets: totalAssetsNum,
    };
  }, [totalAssets, aTokenBalance, assetDecimals]);

  // Check if user has a position (shares > 0)
  // Only consider hasPosition true if we've loaded the balance and it's > 0
  const hasPosition = !isShareBalanceLoading && shareBalance !== undefined && shareBalance > 0n;
  
  // Disable withdraw button only if:
  // 1. No wallet connected, OR
  // 2. We've finished loading AND confirmed user has no shares
  // Keep button enabled during loading to avoid showing inactive state when user actually has shares
  const isWithdrawDisabled = !userAddress || (!isShareBalanceLoading && (shareBalance === undefined || shareBalance === 0n));
  
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
          {
            id: "withdraw",
            label: "Withdraw",
            ariaLabel: "Withdraw from vault",
            onClick: handleOpenWithdraw,
            disabled: isWithdrawDisabled,
          },
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
            {aTokenBalanceDisplay && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900">aBaseUSDC Balance:</span>
                  <span className="font-mono text-emerald-700">
                    {aTokenBalanceDisplay} aBaseUSDC
                  </span>
                </div>
                <div className="mt-1 text-xs text-emerald-700">
                  💰 Interest accruing in real-time on Aave
                </div>
                {aTokenAddress && (
                  <Link
                    href={`https://basescan.org/address/${aTokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-xs text-emerald-600 underline"
                  >
                    View aToken on Basescan
                  </Link>
                )}
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
        userAssetBalance={(userAssetBalance as bigint) ?? 0n}
        assetDecimals={assetDecimals}
      />
    </>
  );
};

