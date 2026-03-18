"use client";

import { useMemo } from "react";
import { Address, formatUnits } from "viem";
import {
  evmAddress,
  chainId as aaveChainId,
  PageSize,
  OrderDirection,
  VaultUserActivityTimeWindow,
  useVaultUserTransactionHistory,
  useVaultUserActivity,
} from "@aave/react";

import { Modal } from "@/components/common/Modal";

type HistoryItem = {
  __typename?: string;
  txHash?: string;
  timestamp?: string;
  asset?: { amount?: { value?: string }; usd?: string };
  shares?: { amount?: { value?: string } };
};

type VaultActivityModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: Address;
  chainId: number;
  userAddress: Address | undefined;
  assetSymbol?: string;
  /** Current asset value of user's vault shares (from convertToAssets(balanceOf(user))). Used for "Earned (all time)" fallback when API returns zero. */
  currentAssetValueWei?: bigint;
  /** Token decimals (e.g. 6 for USDC). Required for earned-all-time fallback when currentAssetValueWei is provided. */
  assetDecimals?: number;
};

export function VaultActivityModal({
  open,
  onClose,
  vaultAddress,
  chainId,
  userAddress,
  assetSymbol = "USDC",
  currentAssetValueWei,
  assetDecimals = 6,
}: VaultActivityModalProps) {
  const chainIdTag = useMemo(() => aaveChainId(chainId), [chainId]);

  const { data: historyData, loading: historyLoading } = useVaultUserTransactionHistory(
    open && userAddress
      ? {
          vault: evmAddress(vaultAddress),
          chainId: chainIdTag,
          user: evmAddress(userAddress),
          orderBy: { date: OrderDirection.Desc },
          pageSize: PageSize.Fifty,
        }
      : ({} as Parameters<typeof useVaultUserTransactionHistory>[0]),
  );

  const { data: activityData, loading: activityLoading } = useVaultUserActivity(
    open && userAddress
      ? {
          vault: evmAddress(vaultAddress),
          chainId: chainIdTag,
          user: evmAddress(userAddress),
          window: VaultUserActivityTimeWindow.LastWeek,
        }
      : ({} as Parameters<typeof useVaultUserActivity>[0]),
  );

  const items = (historyData?.items ?? []) as HistoryItem[];
  const earned = activityData?.earned;
  const breakdown = activityData?.breakdown ?? [];

  const apiEarnedIsZero =
    earned == null ||
    earned.amount?.value == null ||
    parseFloat(earned.amount.value) === 0;

  const { totalDeposited, totalWithdrawn } = useMemo(() => {
    let deposited = 0;
    let withdrawn = 0;
    for (const item of items) {
      const value = parseFloat(item.asset?.amount?.value ?? "0") || 0;
      if (item.__typename === "VaultUserDepositItem") deposited += value;
      else if (item.__typename === "VaultUserWithdrawItem") withdrawn += value;
    }
    return { totalDeposited: deposited, totalWithdrawn: withdrawn };
  }, [items]);

  const earnedAllTime = useMemo(() => {
    if (
      currentAssetValueWei == null ||
      currentAssetValueWei === 0n ||
      assetDecimals == null
    ) {
      return null;
    }
    const currentValue = parseFloat(formatUnits(currentAssetValueWei, assetDecimals));
    const netDeposits = totalDeposited - totalWithdrawn;
    const value = currentValue - netDeposits;
    return value < 0 ? 0 : value;
  }, [currentAssetValueWei, assetDecimals, totalDeposited, totalWithdrawn]);

  const showEarnedAllTimeFallback =
    apiEarnedIsZero && earnedAllTime != null && items.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vault activity"
      showCloseButton
      className="max-w-2xl bg-white text-slate-900"
    >
      <div className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700">
        {activityLoading ? (
          <p className="text-sm text-slate-500">Loading activity…</p>
        ) : (
          <>
            <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-semibold text-slate-900">
                Earned (last 7 days)
              </h4>
              <p className="text-lg font-semibold text-slate-900">
                {earned?.amount?.value ?? "0"} {assetSymbol}
                {earned?.usd != null && (
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    (${earned.usd})
                  </span>
                )}
              </p>
              {apiEarnedIsZero && (
                <p className="text-xs text-slate-500">
                  From Aave. If this shows 0, see “Earned (all time)” below.
                </p>
              )}
            </section>

            {showEarnedAllTimeFallback && (
              <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-base font-semibold text-slate-900">
                  Earned (all time)
                </h4>
                <p className="text-lg font-semibold text-slate-900">
                  {earnedAllTime.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{" "}
                  {assetSymbol}
                </p>
                <p className="text-xs text-slate-500">
                  Computed from your current balance and deposit/withdraw history.
                </p>
              </section>
            )}

            {breakdown.length > 0 && (
              <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-base font-semibold text-slate-900">
                  Activity breakdown
                </h4>
                <div className="max-h-[min(12rem,40vh)] overflow-y-auto">
                  <ul className="space-y-2">
                    {breakdown.map((row, i) => (
                      <li
                        key={String(row.date ?? i)}
                        className="flex justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <span className="text-slate-600">
                          {String(row.date ?? "—")}
                        </span>
                        <span className="text-slate-900">
                          Balance: {row.balance?.amount?.value ?? "0"} · Earned:{" "}
                          {row.earned?.amount?.value ?? "0"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {apiEarnedIsZero && (
                  <p className="text-xs text-slate-500">
                    Daily earned is from Aave; if it shows 0, see “Earned (all
                    time)” above.
                  </p>
                )}
              </section>
            )}

            <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-semibold text-slate-900">
                Recent transactions
              </h4>
              {historyLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-slate-500">No transactions yet.</p>
              ) : (
                <div className="max-h-[min(14rem,40vh)] overflow-y-auto">
                  <ul className="space-y-2" aria-label="Vault transaction history">
                    {items.map((item, i) => (
                      <li
                        key={item.txHash ?? i}
                        className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-slate-700">
                          {item.__typename === "VaultUserDepositItem"
                            ? "Deposit"
                            : "Withdraw"}
                        </span>
                        {item.asset?.amount?.value != null && (
                          <span className="text-slate-600">
                            {item.asset.amount.value} {assetSymbol}
                            {item.asset.usd != null &&
                              ` ($${item.asset.usd})`}
                          </span>
                        )}
                        {item.txHash && (
                          <a
                            href={`https://basescan.org/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-slate-500 underline"
                          >
                            {item.txHash.slice(0, 10)}…
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
