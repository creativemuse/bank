"use client";

import { useMemo } from "react";
import { Address } from "viem";
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

type VaultActivityModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: Address;
  chainId: number;
  userAddress: Address | undefined;
  assetSymbol?: string;
};

export function VaultActivityModal({
  open,
  onClose,
  vaultAddress,
  chainId,
  userAddress,
  assetSymbol = "USDC",
}: VaultActivityModalProps) {
  const chainIdTag = useMemo(() => aaveChainId(chainId), [chainId]);

  const { data: historyData, loading: historyLoading } = useVaultUserTransactionHistory(
    open && userAddress
      ? {
          vault: evmAddress(vaultAddress),
          chainId: chainIdTag,
          user: evmAddress(userAddress),
          orderBy: { date: OrderDirection.Desc },
          pageSize: PageSize.Ten,
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

  const items = historyData?.items ?? [];
  const earned = activityData?.earned;
  const breakdown = activityData?.breakdown ?? [];

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
        ) : earned != null ? (
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-base font-semibold text-slate-900">Earned (period)</h4>
            <p className="text-lg font-semibold text-slate-900">
              {earned.amount?.value ?? "0"} {assetSymbol}
              {earned.usd != null && (
                <span className="ml-2 text-sm font-normal text-slate-600">
                  (${earned.usd})
                </span>
              )}
            </p>
          </section>
        ) : null}

        {breakdown.length > 0 && (
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-base font-semibold text-slate-900">Activity breakdown</h4>
            <ul className="space-y-2">
              {breakdown.slice(0, 7).map((row, i) => (
                <li
                  key={String(row.date ?? i)}
                  className="flex justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <span className="text-slate-600">{String(row.date ?? "—")}</span>
                  <span className="text-slate-900">
                    Balance: {row.balance?.amount?.value ?? "0"} · Earned:{" "}
                    {row.earned?.amount?.value ?? "0"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-base font-semibold text-slate-900">Recent transactions</h4>
          {historyLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">No transactions yet.</p>
          ) : (
            <ul className="space-y-2" aria-label="Vault transaction history">
              {items.map((item: { __typename?: string; txHash?: string; timestamp?: string; asset?: { amount?: { value?: string }; usd?: string }; shares?: { amount?: { value?: string } } }, i: number) => (
                <li
                  key={item.txHash ?? i}
                  className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-700">
                    {item.__typename === "VaultUserDepositItem" ? "Deposit" : "Withdraw"}
                  </span>
                  {item.asset?.amount?.value != null && (
                    <span className="text-slate-600">
                      {item.asset.amount.value} {assetSymbol}
                      {item.asset.usd != null && ` ($${item.asset.usd})`}
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
          )}
        </section>
      </div>
    </Modal>
  );
}
