"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import {
  bigDecimal,
  evmAddress,
  errAsync,
  useAaveHealthFactorPreview,
  useBorrow,
  useCollateralToggle,
  useRepay,
  useSupply,
  useUserBorrows,
  useUserMarketState,
  useUserSupplies,
  useUserTransactionHistory,
  useUserMeritRewards,
  useWithdraw,
  OrderDirection,
  PageSize,
} from "@aave/react";
import { useSendTransaction } from "@aave/react/viem";

import { Modal } from "@/components/common/Modal";
import { CopyWrapper } from "@/components/common/CopyWrapper";
import { PremiumGuard } from "@/components/access/PremiumGuard";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
import { useBalance } from "@/hooks/useBalance";
import { useAaveWalletClient } from "@/hooks/useAaveWalletClient";
import { useMembership } from "@/context/MembershipContext";
import { formatPercent, formatUsd } from "@/lib/formatters";
import { shortenAddress } from "@/utils/shortenAddress";
import { AAVE_TARGET_CHAIN_ID } from "@/lib/config/aave";
import type { WalletClient } from "viem";
import type { Market, Reserve } from "@aave/react";
import type { MarketUserReserveSupplyPosition, MarketUserReserveBorrowPosition } from "@aave/react";

const AAVE_USDC_RESERVE_URL =
  "https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3";

type ActionModalKind = "supply" | "withdraw" | "borrow" | "repay" | null;

export default function LendingPage() {
  const { wallet, status: walletStatus } = useWallet();
  const { status: authStatus } = useAuth();
  const membership = useMembership();
  const baseReserve = useBaseUsdcReserve();
  const walletClient = useAaveWalletClient();
  const { balances, displayableBalance, isLoading: isBalanceLoading } = useBalance();
  const [sendTransaction] = useSendTransaction(walletClient);
  const [actionModal, setActionModal] = useState<ActionModalKind>(null);

  const walletUsdcBalance = balances?.usdc?.amount ?? "0";

  const walletAddress = useMemo(() => {
    if (!wallet || authStatus !== "logged-in" || !wallet.address) return null;
    return wallet.address;
  }, [authStatus, wallet]);

  const walletStatusLabel = useMemo(() => {
    if (walletStatus === "in-progress" || authStatus === "initializing") return "Connecting...";
    if (!wallet || authStatus !== "logged-in") return "Not connected";
    return shortenAddress(wallet.address ?? "");
  }, [authStatus, wallet, walletStatus]);

  const marketsInput = useMemo(() => {
    if (!baseReserve.market?.address) return [];
    return [
      {
        address: evmAddress(baseReserve.market.address),
        chainId: AAVE_TARGET_CHAIN_ID,
      },
    ];
  }, [baseReserve.market?.address]);

  const userEvm = useMemo(
    () => (walletAddress ? evmAddress(walletAddress) : evmAddress("0x0000000000000000000000000000000000000000")),
    [walletAddress],
  );

  const { data: supplies = [], loading: suppliesLoading } = useUserSupplies({
    markets: marketsInput,
    user: userEvm,
  });

  const { data: borrows = [], loading: borrowsLoading } = useUserBorrows({
    markets: marketsInput,
    user: userEvm,
  });

  const marketAddressEvm = useMemo(
    () => (baseReserve.market?.address ? evmAddress(baseReserve.market.address) : evmAddress("0x0000000000000000000000000000000000000000")),
    [baseReserve.market?.address],
  );

  const { data: userMarketState, loading: marketStateLoading } = useUserMarketState({
    market: marketAddressEvm,
    user: userEvm,
    chainId: AAVE_TARGET_CHAIN_ID,
  });

  const usdcSupplyPosition = useMemo(
    () => supplies.find((s) => s.currency?.symbol?.toUpperCase() === "USDC"),
    [supplies],
  );
  const usdcBorrowPosition = useMemo(
    () => borrows.find((b) => b.currency?.symbol?.toUpperCase() === "USDC"),
    [borrows],
  );

  const canToggleCollateral =
    usdcSupplyPosition &&
    usdcSupplyPosition.canBeCollateral != null &&
    (usdcSupplyPosition.isCollateral ? true : usdcSupplyPosition.canBeCollateral);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Link
            href="/"
            aria-label="Return to Creative Bank home"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Back to Home
          </Link>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-lg shadow-slate-900/10 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Aave Markets
          </p>
          <h1 className="text-center text-3xl font-semibold text-slate-900 md:text-4xl">
            Borrow & Lend
          </h1>
          <p className="mx-auto max-w-2xl text-center text-sm leading-6 text-slate-600">
            Supply USDC to earn interest or borrow against your collateral on Aave V3 (Base). Manage
            your positions and health factor in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Connected Wallet:{" "}
            {walletAddress ? (
              <CopyWrapper
                toCopy={walletAddress}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                iconPosition="right"
              >
                <span>{walletStatusLabel}</span>
              </CopyWrapper>
            ) : (
              <span>{walletStatusLabel}</span>
            )}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Membership Tier: {membership.isLoading ? "Checking..." : membership.tier ?? "None"}
          </span>
        </div>
      </header>

      {baseReserve.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load Aave market data: {baseReserve.error.message}
        </div>
      ) : null}

      {baseReserve.loading || !baseReserve.market || !baseReserve.reserve ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          Loading market…
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">USDC on Base</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Supply APY</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatPercent(baseReserve.reserve?.supplyInfo?.apy?.formatted)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Borrow APY</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatPercent(baseReserve.reserve?.borrowInfo?.apy?.formatted)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total size</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatUsd(baseReserve.reserve?.size?.usd)}
                </p>
              </div>
              <div className="flex items-end">
                <a
                  href={AAVE_USDC_RESERVE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View on Aave →
                </a>
              </div>
            </div>
          </section>

          {walletAddress && (
            <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Your positions</h2>
              {marketStateLoading || suppliesLoading || borrowsLoading ? (
                <p className="text-sm text-slate-500">Loading positions…</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {userMarketState?.healthFactor != null && (
                    <div>
                      <p className="text-xs text-slate-500">Health factor</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {Number(userMarketState.healthFactor).toFixed(2)}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Supplied (USDC)</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {usdcSupplyPosition?.balance?.amount?.value ?? "0"}
                      </p>
                      {usdcSupplyPosition?.balance?.usd != null && (
                        <p className="text-xs text-slate-500">
                          {formatUsd(usdcSupplyPosition.balance.usd)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Borrowed (USDC)</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {usdcBorrowPosition?.debt?.amount?.value ?? "0"}
                      </p>
                      {usdcBorrowPosition?.debt?.usd != null && (
                        <p className="text-xs text-slate-500">
                          {formatUsd(usdcBorrowPosition.debt.usd)}
                        </p>
                      )}
                    </div>
                  </div>
                  {canToggleCollateral && (
                    <CollateralToggle
                      market={baseReserve.market}
                      position={usdcSupplyPosition!}
                      userEvm={userEvm!}
                      walletClient={walletClient}
                      onSuccess={() => {}}
                    />
                  )}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Actions</h2>
            {!walletClient ? (
              <p className="text-sm text-slate-500">Connect a wallet to supply, withdraw, borrow, or repay.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActionModal("supply")}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Supply USDC
                </button>
                <button
                  type="button"
                  onClick={() => setActionModal("withdraw")}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                >
                  Withdraw
                </button>
                <button
                  type="button"
                  onClick={() => setActionModal("borrow")}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                >
                  Borrow USDC
                </button>
                <button
                  type="button"
                  onClick={() => setActionModal("repay")}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                >
                  Repay
                </button>
              </div>
            )}
          </section>

          <PremiumGuard requiredTier="Creative Creator">
            <LendingAdvancedSection
              marketAddressEvm={marketAddressEvm}
              userEvm={userEvm}
              walletAddress={walletAddress}
              walletClient={walletClient}
              reserve={baseReserve.reserve ?? undefined}
            />
          </PremiumGuard>
        </>
      )}

      {actionModal === "supply" && baseReserve.reserve && baseReserve.market && walletAddress && walletClient && (
        <SupplyModal
          market={baseReserve.market}
          reserve={baseReserve.reserve}
          sender={evmAddress(walletAddress)}
          walletClient={walletClient ?? undefined}
          walletUsdcBalance={walletUsdcBalance}
          isBalanceLoading={isBalanceLoading}
          onClose={() => setActionModal(null)}
          onSuccess={() => setActionModal(null)}
        />
      )}
      {actionModal === "withdraw" && baseReserve.reserve && baseReserve.market && walletAddress && walletClient && (
        <WithdrawModal
          market={baseReserve.market}
          reserve={baseReserve.reserve}
          supplyPosition={usdcSupplyPosition ?? undefined}
          sender={evmAddress(walletAddress)}
          walletClient={walletClient ?? undefined}
          onClose={() => setActionModal(null)}
          onSuccess={() => setActionModal(null)}
        />
      )}
      {actionModal === "borrow" && baseReserve.reserve && baseReserve.market && walletAddress && walletClient && (
        <BorrowModal
          market={baseReserve.market}
          reserve={baseReserve.reserve}
          sender={evmAddress(walletAddress)}
          walletClient={walletClient ?? undefined}
          onClose={() => setActionModal(null)}
          onSuccess={() => setActionModal(null)}
        />
      )}
      {actionModal === "repay" && baseReserve.reserve && baseReserve.market && walletAddress && walletClient && (
        <RepayModal
          market={baseReserve.market}
          reserve={baseReserve.reserve}
          borrowPosition={usdcBorrowPosition ?? undefined}
          sender={evmAddress(walletAddress)}
          walletClient={walletClient ?? undefined}
          onClose={() => setActionModal(null)}
          onSuccess={() => setActionModal(null)}
        />
      )}
    </main>
  );
}

type LendingAdvancedSectionProps = {
  marketAddressEvm: ReturnType<typeof evmAddress>;
  userEvm: ReturnType<typeof evmAddress>;
  walletAddress: string | null;
  walletClient: WalletClient | undefined;
  reserve?: Reserve | null;
};

function LendingAdvancedSection({
  marketAddressEvm,
  userEvm,
  walletAddress,
  walletClient,
  reserve,
}: LendingAdvancedSectionProps) {
  const [txCursor, setTxCursor] = useState<string | undefined>(undefined);
  const [accumulatedTxItems, setAccumulatedTxItems] = useState<Array<{ __typename?: string; timestamp?: string; txHash?: string }>>([]);
  const [txNextCursor, setTxNextCursor] = useState<string | undefined>(undefined);

  const { data: txHistory, loading: txHistoryLoading } = useUserTransactionHistory({
    market: marketAddressEvm,
    user: userEvm,
    chainId: AAVE_TARGET_CHAIN_ID,
    orderBy: { date: OrderDirection.Desc },
    pageSize: PageSize.Fifty,
    ...(txCursor != null && { cursor: txCursor as never }),
  });

  useEffect(() => {
    if (txHistory?.items == null) return;
    const items = txHistory.items as Array<{ __typename?: string; timestamp?: string; txHash?: string }>;
    if (txCursor == null) {
      setAccumulatedTxItems((prev) => (prev.length === 0 ? items : prev));
    } else {
      setAccumulatedTxItems((prev) => [...prev, ...items]);
    }
    setTxNextCursor(txHistory.pageInfo?.next ?? undefined);
    setTxCursor(undefined);
  }, [txHistory?.items, txHistory?.pageInfo?.next, txCursor]);

  const [previewAmount, setPreviewAmount] = useState("");
  const [healthPreview, healthPreviewRunning] = useAaveHealthFactorPreview();
  const [healthPreviewResult, setHealthPreviewResult] = useState<{ before: string | null; after: string | null } | null>(null);

  const handleHealthPreview = useCallback(async () => {
    const num = Number.parseFloat(previewAmount);
    if (!reserve || Number.isNaN(num) || num <= 0) return;
    setHealthPreviewResult(null);
    const result = await healthPreview({
      action: {
        supply: {
          market: marketAddressEvm,
          amount: {
            erc20: {
              currency: reserve.underlyingToken.address,
              value: bigDecimal(num),
            },
          },
          sender: userEvm,
          chainId: AAVE_TARGET_CHAIN_ID,
        },
      },
    });
    if (result.isOk()) {
      const v = result.value;
      setHealthPreviewResult({
        before: v.before != null ? String(v.before) : null,
        after: v.after != null ? String(v.after) : null,
      });
    } else {
      setHealthPreviewResult({ before: null, after: null });
    }
  }, [previewAmount, reserve, healthPreview, marketAddressEvm, userEvm]);

  const handleLoadMoreTx = useCallback(() => {
    if (txNextCursor != null) setTxCursor(txNextCursor);
  }, [txNextCursor]);

  const { data: meritRewards, loading: meritLoading } = useUserMeritRewards({
    user: userEvm,
    chainId: AAVE_TARGET_CHAIN_ID,
  });
  const [sendTransaction, sending] = useSendTransaction(walletClient ?? undefined);
  const [meritError, setMeritError] = useState<string | null>(null);

  const handleClaimMerit = useCallback(async () => {
    if (meritRewards == null || !walletClient) return;
    setMeritError(null);
    const result = await sendTransaction(meritRewards.transaction);
    if (result.isErr()) {
      setMeritError(result.error?.message ?? "Claim failed");
    }
  }, [meritRewards, walletClient, sendTransaction]);

  const displayTxItems = txCursor == null ? accumulatedTxItems : (txHistory?.items ?? accumulatedTxItems) as Array<{ __typename?: string; timestamp?: string; txHash?: string }>;
  const showLoadMore = Boolean(txNextCursor && !txHistoryLoading);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Advanced (Members)</h2>
      {!walletAddress ? (
        <p className="text-sm text-slate-500">Connect a wallet to see transaction history and claim rewards.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {reserve != null && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-700">Health factor preview</h3>
              <p className="mb-2 text-xs text-slate-500">Preview health factor after supplying USDC.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={previewAmount}
                  onChange={(e) => setPreviewAmount(e.target.value)}
                  placeholder="Amount (e.g. 100)"
                  className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                  aria-label="Preview supply amount"
                />
                <button
                  type="button"
                  onClick={handleHealthPreview}
                  disabled={healthPreviewRunning.loading || !previewAmount}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  {healthPreviewRunning.loading ? "Previewing…" : "Preview"}
                </button>
              </div>
              {healthPreviewResult != null && (
                <p className="mt-2 text-sm text-slate-600">
                  Before: {healthPreviewResult.before ?? "—"} → After: {healthPreviewResult.after ?? "—"}
                </p>
              )}
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">Transaction history</h3>
            {txHistoryLoading && accumulatedTxItems.length === 0 ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : displayTxItems.length > 0 ? (
              <>
                <ul className="max-h-48 list-none space-y-2 overflow-y-auto text-sm">
                  {displayTxItems.map((item, i) => (
                    <li key={(item as { txHash?: string }).txHash ?? i} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50/50 px-3 py-2">
                      <span className="text-slate-600">{(item as { __typename?: string }).__typename ?? "Transaction"}</span>
                      <span className="text-xs text-slate-500">{item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "—"}</span>
                    </li>
                  ))}
                </ul>
                {showLoadMore && (
                  <button
                    type="button"
                    onClick={handleLoadMoreTx}
                    disabled={txHistoryLoading}
                    className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Load more
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No transactions yet.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">Merit rewards</h3>
            {meritLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : meritRewards != null ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-600">You have claimable rewards.</p>
                <button
                  type="button"
                  onClick={handleClaimMerit}
                  disabled={sending.loading || !walletClient}
                  className="w-fit rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {sending.loading ? "Claiming…" : "Claim rewards"}
                </button>
                {meritError && <p className="text-sm text-red-600">{meritError}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No claimable Merit rewards.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CollateralToggle({
  market,
  position,
  userEvm,
  walletClient,
  onSuccess,
}: {
  market: Market;
  position: MarketUserReserveSupplyPosition;
  userEvm: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  onSuccess: () => void;
}) {
  const [toggleCollateral, toggling] = useCollateralToggle();
  const [sendTransaction, sending] = useSendTransaction(walletClient ?? undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggle = useCallback(async () => {
    if (!walletClient) return;
    setErrorMsg(null);
    const result = await toggleCollateral({
      market: market.address,
      underlyingToken: position.currency.address,
      user: userEvm,
      chainId: AAVE_TARGET_CHAIN_ID,
    }).andThen(sendTransaction);
    if (result.isErr()) {
      setErrorMsg(result.error?.message ?? "Toggle failed");
    } else {
      onSuccess();
    }
  }, [market.address, position.currency.address, userEvm, walletClient, toggleCollateral, sendTransaction, onSuccess]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">
        Collateral: {position.isCollateral ? "Enabled" : "Disabled"}
      </p>
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling.loading || sending.loading || !walletClient}
        className="w-fit rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
      >
        {toggling.loading || sending.loading ? "Processing…" : position.isCollateral ? "Disable collateral" : "Enable collateral"}
      </button>
      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
    </div>
  );
}

function SupplyModal({
  market,
  reserve,
  sender,
  walletClient,
  walletUsdcBalance,
  isBalanceLoading,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  walletUsdcBalance: string;
  isBalanceLoading?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [supply, supplying] = useSupply();
  const [sendTransaction, sending] = useSendTransaction(walletClient ?? undefined);
  const [amount, setAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const permitSupported = reserve.permitSupported === true;

  const parsed = useMemo(() => {
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount]);

  const handleMaxClick = useCallback(() => {
    setAmount(walletUsdcBalance);
  }, [walletUsdcBalance]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (parsed == null || !walletClient) return;
      const result = await supply({
        market: market.address,
        amount: {
          erc20: {
            currency: reserve.underlyingToken.address,
            value: bigDecimal(parsed),
          },
        },
        sender,
        chainId: AAVE_TARGET_CHAIN_ID,
      }).andThen((plan) => {
        if (plan.__typename === "InsufficientBalanceError") {
          return errAsync(new Error(`Insufficient balance. Required: ${plan.required?.value} USDC.`));
        }
        if (plan.__typename === "TransactionRequest") {
          return sendTransaction(plan);
        }
        return sendTransaction(plan.approval).andThen(() => sendTransaction(plan.originalTransaction));
      });
      if (result.isErr()) {
        setErrorMessage(result.error?.message ?? "Supply failed");
        return;
      }
      onSuccess();
      onClose();
    },
    [parsed, walletClient, supply, sendTransaction, market.address, reserve.underlyingToken.address, sender, onSuccess, onClose],
  );

  const balanceDisplay = isBalanceLoading ? "Loading…" : (parseFloat(walletUsdcBalance).toFixed(2));

  return (
    <Modal open title="Supply USDC" onClose={onClose} showCloseButton className="max-w-lg bg-white text-slate-900">
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Amount (USDC)</span>
            <span className="text-xs text-slate-500">Available: {balanceDisplay} USDC</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          />
          <button
            type="button"
            onClick={handleMaxClick}
            disabled={isBalanceLoading || !walletUsdcBalance || parseFloat(walletUsdcBalance) <= 0}
            className="w-fit text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            Use max
          </button>
        </label>
        {permitSupported && (
          <p className="text-xs text-slate-500">
            This reserve supports Permit (EIP-2612). Members can sign a message to skip the approval transaction in a future update.
          </p>
        )}
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={supplying.loading || sending.loading || parsed == null}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {supplying.loading || sending.loading ? "Processing…" : "Supply"}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WithdrawModal({
  market,
  reserve,
  supplyPosition,
  sender,
  walletClient,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  supplyPosition?: MarketUserReserveSupplyPosition;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [withdraw, withdrawing] = useWithdraw();
  const [sendTransaction, sending] = useSendTransaction(walletClient ?? undefined);
  const [amount, setAmount] = useState("");
  const [useMax, setUseMax] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (useMax) return null;
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount, useMax]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (!walletClient) return;
      const result = await withdraw({
        market: market.address,
        amount: {
          erc20: {
            currency: reserve.underlyingToken.address,
            value: useMax ? { max: true } : { exact: bigDecimal(parsed!) },
          },
        },
        sender,
        chainId: AAVE_TARGET_CHAIN_ID,
      }).andThen((plan) => {
        if (plan.__typename === "InsufficientBalanceError") {
          return errAsync(new Error(`Insufficient balance. Required: ${plan.required?.value} USDC.`));
        }
        if (plan.__typename === "TransactionRequest") {
          return sendTransaction(plan);
        }
        return sendTransaction(plan.approval).andThen(() => sendTransaction(plan.originalTransaction));
      });
      if (result.isErr()) {
        setErrorMessage(result.error?.message ?? "Withdraw failed");
        return;
      }
      onSuccess();
      onClose();
    },
    [useMax, parsed, walletClient, withdraw, sendTransaction, market.address, reserve.underlyingToken.address, sender, onSuccess, onClose],
  );

  const balance = supplyPosition?.balance?.amount?.value ?? "0";

  return (
    <Modal open title="Withdraw USDC" onClose={onClose} showCloseButton className="max-w-lg bg-white text-slate-900">
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-500">Amount (USDC) — Balance: {balance}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setUseMax(false); }}
            placeholder="0"
            disabled={useMax}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
          />
          <button type="button" onClick={() => setUseMax(true)} className="w-fit text-xs font-medium text-primary hover:underline">
            Use max
          </button>
        </label>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={withdrawing.loading || sending.loading || (!useMax && parsed == null)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {withdrawing.loading || sending.loading ? "Processing…" : "Withdraw"}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BorrowModal({
  market,
  reserve,
  sender,
  walletClient,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [borrow, borrowing] = useBorrow();
  const [sendTransaction, sending] = useSendTransaction(walletClient ?? undefined);
  const [amount, setAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (parsed == null || !walletClient) return;
      const result = await borrow({
        market: market.address,
        amount: {
          erc20: {
            currency: reserve.underlyingToken.address,
            value: bigDecimal(parsed),
          },
        },
        sender,
        chainId: AAVE_TARGET_CHAIN_ID,
      }).andThen((plan) => {
        if (plan.__typename === "InsufficientBalanceError") {
          return errAsync(new Error(`Insufficient balance. Required: ${plan.required?.value} USDC.`));
        }
        if (plan.__typename === "TransactionRequest") {
          return sendTransaction(plan);
        }
        return sendTransaction(plan.approval).andThen(() => sendTransaction(plan.originalTransaction));
      });
      if (result.isErr()) {
        setErrorMessage(result.error?.message ?? "Borrow failed");
        return;
      }
      onSuccess();
      onClose();
    },
    [parsed, walletClient, borrow, sendTransaction, market.address, reserve.underlyingToken.address, sender, onSuccess, onClose],
  );

  return (
    <Modal open title="Borrow USDC" onClose={onClose} showCloseButton className="max-w-lg bg-white text-slate-900">
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-500">Amount (USDC)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          />
        </label>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={borrowing.loading || sending.loading || parsed == null}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {borrowing.loading || sending.loading ? "Processing…" : "Borrow"}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RepayModal({
  market,
  reserve,
  borrowPosition,
  sender,
  walletClient,
  onClose,
  onSuccess,
}: {
  market: Market;
  reserve: Reserve;
  borrowPosition?: MarketUserReserveBorrowPosition;
  sender: ReturnType<typeof evmAddress>;
  walletClient: WalletClient | undefined;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [repay, repaying] = useRepay();
  const [sendTransaction, sending] = useSendTransaction(walletClient ?? undefined);
  const [amount, setAmount] = useState("");
  const [useMax, setUseMax] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (useMax) return null;
    const n = Number.parseFloat(amount);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }, [amount, useMax]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (!walletClient) return;
      const result = await repay({
        market: market.address,
        amount: {
          erc20: {
            currency: reserve.underlyingToken.address,
            value: useMax ? { max: true } : { exact: bigDecimal(parsed!) },
          },
        },
        sender,
        chainId: AAVE_TARGET_CHAIN_ID,
      }).andThen((plan) => {
        if (plan.__typename === "InsufficientBalanceError") {
          return errAsync(new Error(`Insufficient balance. Required: ${plan.required?.value} USDC.`));
        }
        if (plan.__typename === "TransactionRequest") {
          return sendTransaction(plan);
        }
        return sendTransaction(plan.approval).andThen(() => sendTransaction(plan.originalTransaction));
      });
      if (result.isErr()) {
        setErrorMessage(result.error?.message ?? "Repay failed");
        return;
      }
      onSuccess();
      onClose();
    },
    [useMax, parsed, walletClient, repay, sendTransaction, market.address, reserve.underlyingToken.address, sender, onSuccess, onClose],
  );

  const debt = borrowPosition?.debt?.amount?.value ?? "0";

  return (
    <Modal open title="Repay USDC" onClose={onClose} showCloseButton className="max-w-lg bg-white text-slate-900">
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-500">Amount (USDC) — Debt: {debt}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setUseMax(false); }}
            placeholder="0"
            disabled={useMax}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
          />
          <button type="button" onClick={() => setUseMax(true)} className="w-fit text-xs font-medium text-primary hover:underline">
            Repay max
          </button>
        </label>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={repaying.loading || sending.loading || (!useMax && parsed == null)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {repaying.loading || sending.loading ? "Processing…" : "Repay"}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
