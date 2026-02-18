"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import {
  bigDecimal,
  evmAddress,
  errAsync,
  useBorrow,
  useCollateralToggle,
  useRepay,
  useSupply,
  useUserBorrows,
  useUserMarketState,
  useUserSupplies,
  useWithdraw,
} from "@aave/react";
import { useSendTransaction } from "@aave/react/viem";

import { Modal } from "@/components/common/Modal";
import { CopyWrapper } from "@/components/common/CopyWrapper";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
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
  const [sendTransaction] = useSendTransaction(walletClient);
  const [actionModal, setActionModal] = useState<ActionModalKind>(null);

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
        </>
      )}

      {actionModal === "supply" && baseReserve.reserve && baseReserve.market && walletAddress && walletClient && (
        <SupplyModal
          market={baseReserve.market}
          reserve={baseReserve.reserve}
          sender={evmAddress(walletAddress)}
          walletClient={walletClient ?? undefined}
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
  const [supply, supplying] = useSupply();
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

  return (
    <Modal open title="Supply USDC" onClose={onClose} showCloseButton className="max-w-lg bg-white text-slate-900">
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
