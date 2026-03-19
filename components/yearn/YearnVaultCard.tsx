"use client";

import { useState, useCallback, useMemo } from "react";
import { Address, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { YearnVaultModal } from "./YearnVaultModal";
import { NexusCoverModal } from "@/components/nexus/NexusCoverModal";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { NEXUS_YEARN_V3_PRODUCT_ID } from "@/lib/config/nexus-mutual";
import { useYearnVault, useYearnVaultBalance } from "@/hooks/useYearnVaults";
import { useKalaniDepositEligibility } from "@/hooks/useKalaniDepositEligibility";
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
  /** When set, deposit is gated by bouncer (availableDepositLimit). */
  bouncerAddress?: Address;
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
  bouncerAddress,
}: YearnVaultCardProps) => {
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();
  const userAddress = useMemo(() => {
    if (crossmintWallet?.address) return crossmintWallet.address as `0x${string}`;
    return wagmiAddress ?? undefined;
  }, [crossmintWallet?.address, wagmiAddress]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"deposit" | "withdraw">("deposit");
  const [coverModalOpen, setCoverModalOpen] = useState(false);

  const { isEligible: canDepositByBouncer, isLoading: bouncerLoading } =
    useKalaniDepositEligibility(bouncerAddress);

  // Get vault details
  const { totalAssets, isLoading: vaultLoading } = useYearnVault(vaultAddress);

  // Read vault share token decimals (ERC-20 decimals()) so share display matches USDC scale
  const { data: shareDecimalsRaw } = useReadContract({
    address: vaultAddress,
    abi: [
      {
        inputs: [],
        name: "decimals",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "decimals",
    chainId: 8453,
    query: { enabled: !!vaultAddress },
  });
  const shareDecimals = shareDecimalsRaw != null ? Number(shareDecimalsRaw) : 18;

  // Get user's position
  const { shareBalance, assetValue } = useYearnVaultBalance(vaultAddress, userAddress);

  const depositDisabled = Boolean(
    bouncerAddress && (bouncerLoading || !canDepositByBouncer),
  );
  const depositTitle = bouncerAddress && !canDepositByBouncer && !bouncerLoading
    ? "Kalani Vault is for members only. Get a Creative Brand, Investor, or Creator NFT to deposit."
    : undefined;

  const handleOpenDeposit = useCallback(() => {
    if (depositDisabled) return;
    setModalMode("deposit");
    setModalOpen(true);
  }, [depositDisabled]);

  const handleOpenWithdraw = useCallback(() => {
    setModalMode("withdraw");
    setModalOpen(true);
  }, []);

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
            label: bouncerLoading ? "Checking access…" : "Deposit",
            ariaLabel: `Deposit ${assetSymbol} into ${name}`,
            onClick: handleOpenDeposit,
            disabled: depositDisabled,
            title: depositTitle,
          },
          ...(hasPosition
            ? [
                {
                  id: "withdraw",
                  label: "Withdraw",
                  ariaLabel: `Withdraw ${assetSymbol} from ${name}`,
                  onClick: handleOpenWithdraw,
                },
                {
                  id: "buy-cover",
                  label: "Buy Cover",
                  ariaLabel: "Protect position with Nexus Mutual cover",
                  onClick: () => setCoverModalOpen(true),
                },
              ]
            : []),
        ]}
        footnote={
          hasPosition ? (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-slate-900">Your Position</span>
              <p className="text-xs text-slate-500">
                {formatVaultShares(shareBalance, shareDecimals)} shares ≈ {positionValue} {assetSymbol}
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
        shareDecimals={shareDecimals}
      />

      <NexusCoverModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        productId={NEXUS_YEARN_V3_PRODUCT_ID}
        productLabel="Yearn v3"
        assetSymbol={assetSymbol}
        assetDecimals={assetDecimals}
        suggestedAmountWei={assetValue ?? undefined}
        buyerAddress={userAddress}
      />
    </>
  );
};

