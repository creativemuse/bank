"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Address, formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import {
  bigDecimal,
  evmAddress,
  useVaultDeposit,
  useVaultRedeemShares,
  useVaultDepositPreview,
  useVaultRedeemPreview,
  useVaultWithdraw,
  useVaultWithdrawPreview,
} from "@aave/react";

import { Modal } from "@/components/common/Modal";
import { useAaveWalletClient } from "@/hooks/useAaveWalletClient";
import { AAVE_TARGET_CHAIN_ID } from "@/lib/config/aave";
import { formatUsd } from "@/lib/formatters";
import { formatVaultShares } from "@/lib/yearnUtils";
import { toast } from "sonner";

type WithdrawInputMode = "shares" | "asset";

const TX_CONFIRMATION_TIMEOUT_MS = 120_000;

type AaveVaultModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress: Address;
  assetSymbol?: string;
  assetDecimals?: number;
  mode: "deposit" | "withdraw";
  userAddress: Address | undefined;
  userAssetBalance?: bigint;
  shareBalance?: bigint;
  isBalanceLoading?: boolean;
  onSuccess?: () => void;
};

export function AaveVaultModal({
  open,
  onClose,
  vaultAddress,
  assetSymbol = "USDC",
  assetDecimals = 6,
  mode,
  userAddress,
  userAssetBalance = 0n,
  shareBalance = 0n,
  isBalanceLoading = false,
  onSuccess,
}: AaveVaultModalProps) {
  const { address: wagmiAddress } = useAccount();
  const walletClient = useAaveWalletClient();
  const publicClient = usePublicClient();
  const { status: authStatus } = useAuth();
  const { status: walletStatus } = useWallet();

  const [deposit] = useVaultDeposit();
  const [redeem] = useVaultRedeemShares();
  const [withdraw] = useVaultWithdraw();
  const [depositPreview] = useVaultDepositPreview();
  const [redeemPreview] = useVaultRedeemPreview();
  const [withdrawPreview] = useVaultWithdrawPreview();

  const [inputAmount, setInputAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expectedShares, setExpectedShares] = useState<string | null>(null);
  const [expectedAssets, setExpectedAssets] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawInputMode, setWithdrawInputMode] = useState<WithdrawInputMode>("shares");
  const [shareBalanceInUsdc, setShareBalanceInUsdc] = useState<string | null>(null);
  const [isShareBalanceUsdcLoading, setIsShareBalanceUsdcLoading] = useState(false);

  const parsedAmount = useMemo(() => {
    if (!inputAmount || inputAmount === ".") return null;
    const num = Number.parseFloat(inputAmount);
    if (Number.isNaN(num) || num <= 0) return null;
    return num;
  }, [inputAmount]);

  const isWithdrawAssetMode = mode === "withdraw" && withdrawInputMode === "asset";

  useEffect(() => {
    if (mode === "deposit" && parsedAmount != null) {
      setExpectedAssets(null);
      depositPreview({
        vault: evmAddress(vaultAddress),
        chainId: AAVE_TARGET_CHAIN_ID,
        amount: bigDecimal(parsedAmount),
      }).then((result) => {
        if (result.isOk() && result.value?.amount?.value != null) {
          setExpectedShares(String(result.value.amount.value));
        } else {
          setExpectedShares(null);
        }
      });
    } else {
      setExpectedShares(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- depositPreview is stable from hook
  }, [mode, parsedAmount, vaultAddress]);

  useEffect(() => {
    if (mode === "withdraw" && withdrawInputMode === "shares" && parsedAmount != null) {
      setExpectedShares(null);
      redeemPreview({
        vault: evmAddress(vaultAddress),
        chainId: AAVE_TARGET_CHAIN_ID,
        amount: bigDecimal(parsedAmount),
      }).then((result) => {
        if (result.isOk() && result.value?.amount?.value != null) {
          setExpectedAssets(String(result.value.amount.value));
        } else {
          setExpectedAssets(null);
        }
      });
    } else if (mode === "withdraw" && withdrawInputMode === "asset" && parsedAmount != null) {
      setExpectedShares(null);
      withdrawPreview({
        vault: evmAddress(vaultAddress),
        chainId: AAVE_TARGET_CHAIN_ID,
        amount: bigDecimal(parsedAmount),
      }).then((result) => {
        if (result.isOk() && result.value?.amount?.value != null) {
          setExpectedAssets(String(result.value.amount.value));
        } else {
          setExpectedAssets(null);
        }
      });
    } else {
      setExpectedAssets(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- redeemPreview/withdrawPreview stable from hooks
  }, [mode, withdrawInputMode, parsedAmount, vaultAddress]);

  useEffect(() => {
    if (mode !== "withdraw" || !shareBalance || shareBalance === 0n) {
      setShareBalanceInUsdc(null);
      return;
    }
    const shareAmountStr = formatUnits(shareBalance, 18);
    const shareAmountNum = Number.parseFloat(shareAmountStr);
    if (Number.isNaN(shareAmountNum)) {
      setShareBalanceInUsdc(null);
      return;
    }
    setIsShareBalanceUsdcLoading(true);
    void Promise.resolve(
      redeemPreview({
        vault: evmAddress(vaultAddress),
        chainId: AAVE_TARGET_CHAIN_ID,
        amount: bigDecimal(shareAmountNum),
      }),
    )
      .then((result) => {
        if (result.isOk() && result.value?.amount?.value != null) {
          setShareBalanceInUsdc(String(result.value.amount.value));
        } else {
          setShareBalanceInUsdc(null);
        }
      })
      .catch(() => setShareBalanceInUsdc(null))
      .finally(() => setIsShareBalanceUsdcLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- redeemPreview stable from hook
  }, [mode, shareBalance, vaultAddress]);

  const sendAndWait = useCallback(
    async (tx: { to: string; data: string; value?: string }) => {
      if (!walletClient || !publicClient || !userAddress)
        throw new Error("Wallet or RPC not available");
      const valueBigInt = tx.value ? BigInt(tx.value) : 0n;
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: (tx.data || "0x") as `0x${string}`,
        value: valueBigInt,
        account: { address: userAddress, type: "json-rpc" },
        chain: publicClient.chain as never as import("viem").Chain,
      });
      await publicClient.waitForTransactionReceipt({
        hash,
        timeout: TX_CONFIRMATION_TIMEOUT_MS,
      });
      return hash;
    },
    [walletClient, publicClient, userAddress],
  );

  const resetForm = useCallback(() => {
    setInputAmount("");
    setErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = useCallback((): string | null => {
    if (!userAddress) {
      if (authStatus === "initializing" || walletStatus === "in-progress") return "Wallet is connecting...";
      return "Connect a wallet to continue.";
    }
    if (!parsedAmount || parsedAmount <= 0) return "Please enter a valid amount.";
    if (mode === "deposit") {
      if (isBalanceLoading) return "Balance is loading...";
      const required = BigInt(Math.floor(parsedAmount * 10 ** assetDecimals));
      if (userAssetBalance < required) return `Insufficient ${assetSymbol} balance.`;
    } else {
      if (withdrawInputMode === "shares") {
        const sharesWei = BigInt(Math.floor(parsedAmount * 1e18));
        if (shareBalance < sharesWei) return "Insufficient vault shares.";
      } else {
        if (isShareBalanceUsdcLoading) return "Balance is loading...";
        const maxUsdc = shareBalanceInUsdc != null ? Number.parseFloat(shareBalanceInUsdc) : 0;
        if (Number.isNaN(maxUsdc) || parsedAmount > maxUsdc) {
          return `Insufficient balance. Maximum withdrawable: ${shareBalanceInUsdc ?? "0"} ${assetSymbol}.`;
        }
      }
    }
    return null;
  }, [
    userAddress,
    parsedAmount,
    mode,
    withdrawInputMode,
    isBalanceLoading,
    isShareBalanceUsdcLoading,
    shareBalanceInUsdc,
    userAssetBalance,
    shareBalance,
    assetDecimals,
    assetSymbol,
    authStatus,
    walletStatus,
  ]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrorMessage(null);

      const err = validate();
      if (err) {
        setErrorMessage(err);
        return;
      }

      if (!walletClient || !publicClient || !userAddress || parsedAmount == null) {
        setErrorMessage("Wallet or amount not ready.");
        return;
      }

      setIsSubmitting(true);
      try {
        if (mode === "deposit") {
          const depositResult = await deposit({
            chainId: AAVE_TARGET_CHAIN_ID,
            vault: evmAddress(vaultAddress),
            amount: { value: bigDecimal(parsedAmount) },
            depositor: evmAddress(userAddress),
          });

          if (depositResult.isErr()) {
            setErrorMessage(depositResult.error?.message ?? "Deposit failed");
            return;
          }

          const plan = depositResult.value;
          if (plan.__typename === "InsufficientBalanceError") {
            setErrorMessage(`Insufficient balance. Required: ${plan.required?.value} ${assetSymbol}.`);
            return;
          }

          if (plan.__typename === "TransactionRequest") {
            await sendAndWait(plan);
          } else {
            await sendAndWait(plan.approval);
            await sendAndWait(plan.originalTransaction);
          }

          toast.success("Deposit complete", {
            description: `${formatUsd(parsedAmount)} ${assetSymbol} deposited successfully.`,
          });
        } else {
          if (withdrawInputMode === "shares") {
            const redeemResult = await redeem({
              chainId: AAVE_TARGET_CHAIN_ID,
              vault: evmAddress(vaultAddress),
              shares: { amount: bigDecimal(parsedAmount) },
              sharesOwner: evmAddress(userAddress),
            });

            if (redeemResult.isErr()) {
              setErrorMessage(
                (redeemResult.error as Error)?.message ?? "Withdraw failed",
              );
              return;
            }

            await sendAndWait(redeemResult.value);
          } else {
            const withdrawResult = await withdraw({
              chainId: AAVE_TARGET_CHAIN_ID,
              vault: evmAddress(vaultAddress),
              amount: { value: bigDecimal(parsedAmount) },
              sharesOwner: evmAddress(userAddress),
            });

            if (withdrawResult.isErr()) {
              setErrorMessage(
                (withdrawResult.error as Error)?.message ?? "Withdraw failed",
              );
              return;
            }

            await sendAndWait(withdrawResult.value);
          }

          toast.success("Withdraw complete", {
            description: `${formatUsd(parsedAmount)} ${assetSymbol} withdrawn successfully.`,
          });
        }

        resetForm();
        onSuccess?.();
        handleClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : mode === "deposit" ? "Deposit failed" : "Withdraw failed";
        setErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      validate,
      mode,
      withdrawInputMode,
      walletClient,
      publicClient,
      userAddress,
      parsedAmount,
      vaultAddress,
      deposit,
      redeem,
      withdraw,
      sendAndWait,
      assetSymbol,
      onSuccess,
      handleClose,
      resetForm,
    ],
  );

  const handleMaxClick = useCallback(() => {
    if (mode === "deposit" && userAssetBalance !== undefined) {
      setInputAmount(formatUnits(userAssetBalance, assetDecimals));
    } else if (mode === "withdraw") {
      if (withdrawInputMode === "shares" && shareBalance !== undefined) {
        setInputAmount(formatUnits(shareBalance, 18));
      } else if (withdrawInputMode === "asset" && shareBalanceInUsdc != null) {
        setInputAmount(shareBalanceInUsdc);
      }
    }
  }, [mode, withdrawInputMode, userAssetBalance, shareBalance, shareBalanceInUsdc, assetDecimals]);

  if (!open) return null;

  const title = mode === "deposit" ? `Deposit ${assetSymbol}` : `Withdraw ${assetSymbol}`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700" onSubmit={handleSubmit}>
        {mode === "withdraw" && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase text-slate-500">
              Withdraw by
            </span>
            <div
              className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Withdraw input mode"
            >
              <button
                type="button"
                onClick={() => {
                  setWithdrawInputMode("shares");
                  setInputAmount("");
                }}
                className={
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition " +
                  (withdrawInputMode === "shares"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-600 hover:text-slate-900")
                }
                aria-pressed={withdrawInputMode === "shares"}
                aria-label="Enter amount in shares"
              >
                Shares
              </button>
              <button
                type="button"
                onClick={() => {
                  setWithdrawInputMode("asset");
                  setInputAmount("");
                }}
                className={
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition " +
                  (withdrawInputMode === "asset"
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-600 hover:text-slate-900")
                }
                aria-pressed={withdrawInputMode === "asset"}
                aria-label={`Enter amount in ${assetSymbol}`}
              >
                {assetSymbol}
              </button>
            </div>
          </div>
        )}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-slate-500">
                {mode === "deposit"
                  ? `${assetSymbol} Amount`
                  : isWithdrawAssetMode
                    ? `${assetSymbol} to Withdraw`
                    : "Shares to Redeem"}
              </span>
              <span className="text-xs text-slate-500">
                Balance:{" "}
                {mode === "deposit"
                  ? isBalanceLoading
                    ? "Loading..."
                    : formatUnits(userAssetBalance, assetDecimals)
                  : isShareBalanceUsdcLoading
                    ? "Loading..."
                    : shareBalance === 0n
                      ? `0 shares`
                      : `${formatVaultShares(shareBalance)} shares${shareBalanceInUsdc != null ? ` (≈ ${Number(shareBalanceInUsdc).toLocaleString("en-US", { maximumFractionDigits: assetDecimals })} ${assetSymbol})` : ""}`}
              </span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.00"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              aria-label={
                mode === "deposit"
                  ? "Amount to deposit"
                  : isWithdrawAssetMode
                    ? `${assetSymbol} amount to withdraw`
                    : "Shares to redeem"
              }
            />
            <button
              type="button"
              onClick={handleMaxClick}
              disabled={mode === "withdraw" && withdrawInputMode === "asset" && (shareBalanceInUsdc == null || isShareBalanceUsdcLoading)}
              className="self-end text-xs font-medium text-slate-600 underline hover:text-slate-800 disabled:opacity-50 disabled:no-underline"
            >
              Max
            </button>
            {mode === "deposit" && expectedShares != null && (
              <p className="text-xs text-slate-500">
                You will receive approximately {expectedShares} vault shares
              </p>
            )}
            {mode === "withdraw" && withdrawInputMode === "shares" && expectedAssets != null && (
              <p className="text-xs text-slate-500">
                {inputAmount && parsedAmount != null && (
                  <>
                    {parsedAmount} shares ≈ {expectedAssets} {assetSymbol}
                    <br />
                  </>
                )}
                You will receive approximately {expectedAssets} {assetSymbol}
              </p>
            )}
            {mode === "withdraw" && withdrawInputMode === "asset" && (
              <p className="text-xs text-slate-500">
                You will withdraw {inputAmount || "0"} {assetSymbol}
                {expectedAssets != null && (
                  <>
                    {" "}
                    (shares to burn calculated at execution)
                  </>
                )}
              </p>
            )}
          </label>
        </section>

        {errorMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !parsedAmount}
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isSubmitting ? "Confirming..." : mode === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
