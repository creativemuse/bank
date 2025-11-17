"use client";

import { useState, useMemo } from "react";
import { Address } from "viem";
import { useAccount } from "wagmi";
import { YearnVaultModal } from "@/components/yearn/YearnVaultModal";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { useYearnVault, useYearnVaultBalance } from "@/hooks/useYearnVaults";
import { formatPercentage, formatVaultShares } from "@/lib/yearnUtils";
import { formatUnits } from "viem";
import Link from "next/link";

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

  // Get vault details
  const { totalAssets, isLoading: vaultLoading, assetAddress: vaultAssetAddress } = useYearnVault(
    vaultAddress,
  );

  // Get user's position
  const { shareBalance, assetValue } = useYearnVaultBalance(vaultAddress, userAddress);

  // Use the actual asset address from vault if available
  const actualAssetAddress = vaultAssetAddress || assetAddress;

  const handleOpenDeposit = () => {
    setModalMode("deposit");
    setModalOpen(true);
  };

  const handleOpenWithdraw = () => {
    setModalMode("withdraw");
    setModalOpen(true);
  };

  const tvlDisplay = vaultLoading
    ? "Loading..."
    : totalAssets
      ? `$${Number(formatUnits(totalAssets, assetDecimals)).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "—";

  const hasPosition = shareBalance && shareBalance > 0n;
  const positionValue = hasPosition && assetValue
    ? formatUnits(assetValue, assetDecimals)
    : "0";

  const displayName = name || `My Aave Vault`;

  return (
    <>
      <StrategyCard
        title={displayName}
        subtitle="Your deployed Aave USDC Earn Vault"
        apr="—"
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

