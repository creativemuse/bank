"use client";

import { useState } from "react";
import { Address, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { YearnVaultModal } from "./YearnVaultModal";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { useYearnVault, useYearnVaultBalance } from "@/hooks/useYearnVaults";
import { formatPercentage, formatVaultShares } from "@/lib/yearnUtils";

type YearnVaultCardProps = {
  vaultAddress: Address;
  assetAddress: Address;
  assetSymbol?: string;
  assetDecimals?: number;
  name: string;
  description: string;
  estimatedApr?: number;
  userAssetBalance?: bigint;
};

export const YearnVaultCard = ({
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
  name,
  description,
  estimatedApr,
  userAssetBalance = 0n,
}: YearnVaultCardProps) => {
  const { address: userAddress } = useAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw">("deposit");

  // Get vault details
  const { totalAssets, isLoading: vaultLoading } = useYearnVault(vaultAddress);

  // Get user's position
  const { shareBalance, assetValue } = useYearnVaultBalance(vaultAddress, userAddress);

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

  const aprDisplay = formatPercentage(estimatedApr);

  const hasPosition = shareBalance && shareBalance > 0n;
  const positionValue = hasPosition && assetValue
    ? formatUnits(assetValue, assetDecimals)
    : "0";

  return (
    <>
      <StrategyCard
        title={name}
        subtitle={`ERC-4626 Yearn V3 Vault • ${assetSymbol}`}
        apr={aprDisplay}
        tvl={tvlDisplay}
        description={description}
        actions={[
          {
            id: "deposit",
            label: "Deposit",
            ariaLabel: `Deposit ${assetSymbol} into ${name}`,
            onClick: handleOpenDeposit,
          },
          {
            id: "withdraw",
            label: "Withdraw",
            ariaLabel: `Withdraw ${assetSymbol} from ${name}`,
            onClick: handleOpenWithdraw,
            disabled: !hasPosition,
          },
        ]}
        footnote={
          hasPosition ? (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-slate-900">Your Position</span>
              <p className="text-xs text-slate-500">
                {formatVaultShares(shareBalance)} shares ≈ {positionValue} {assetSymbol}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Fully ERC-4626 compliant. All deposits are secured by Yearn&apos;s V3 multi-strategy
              architecture.
            </p>
          )
        }
      />

      <YearnVaultModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        vaultAddress={vaultAddress}
        assetAddress={assetAddress}
        assetSymbol={assetSymbol}
        mode={modalMode}
        userAssetBalance={userAssetBalance}
        assetDecimals={assetDecimals}
      />
    </>
  );
};

