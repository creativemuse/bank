"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { Address, formatUnits } from "viem";
import { useAccount } from "wagmi";

import { Modal } from "@/components/common/Modal";
import { useYearnDeposit } from "@/hooks/useYearnDeposit";
import { useYearnWithdraw } from "@/hooks/useYearnWithdraw";
import { useYearnVaultBalance, usePreviewDeposit, usePreviewRedeem } from "@/hooks/useYearnVaults";
import { MAX_LOSS_BPS } from "@/lib/config/yearn";
import { parseInputAmount, formatVaultShares, formatUsdValue } from "@/lib/yearnUtils";

type YearnVaultModalProps = {
  open: boolean;
  onClose: () => void;
  vaultAddress?: Address;
  assetAddress?: Address;
  assetSymbol?: string;
  mode: "deposit" | "withdraw";
  userAssetBalance?: bigint;
  assetDecimals?: number;
};

export const YearnVaultModal = ({
  open,
  onClose,
  vaultAddress,
  assetAddress,
  assetSymbol = "USDC",
  mode,
  userAssetBalance = 0n,
  assetDecimals = 6,
}: YearnVaultModalProps) => {
  const { address: userAddress } = useAccount();
  
  const [inputAmount, setInputAmount] = useState("");
  const [maxLossPercent, setMaxLossPercent] = useState(1); // Default 1% max loss
  const [validationError, setValidationError] = useState<string | null>(null);

  // Hooks for vault interactions
  const { deposit, state: depositState, reset: resetDeposit } = useYearnDeposit(
    vaultAddress,
    assetAddress,
  );
  const { redeem, state: withdrawState, reset: resetWithdraw } = useYearnWithdraw(vaultAddress);

  // Get user's vault balance
  const { shareBalance, assetValue, refetch: refetchBalance } = useYearnVaultBalance(
    vaultAddress,
    userAddress,
  );

  // Parse input amount to bigint
  const parsedAmount = useMemo(() => {
    return parseInputAmount(inputAmount, assetDecimals);
  }, [inputAmount, assetDecimals]);

  // Preview deposit (get expected shares)
  const { expectedShares } = usePreviewDeposit(
    vaultAddress,
    mode === "deposit" ? parsedAmount ?? undefined : undefined,
  );

  // Preview withdrawal (get expected assets)
  const { expectedAssets } = usePreviewRedeem(
    vaultAddress,
    mode === "withdraw" ? parsedAmount ?? undefined : undefined,
  );

  const state = mode === "deposit" ? depositState : withdrawState;
  const isSubmitting = state.status === "approving" || state.status === "depositing" || state.status === "redeeming";

  const resetForm = useCallback(() => {
    setInputAmount("");
    setMaxLossPercent(1);
    setValidationError(null);
    resetDeposit();
    resetWithdraw();
  }, [resetDeposit, resetWithdraw]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = useCallback(() => {
    if (!userAddress) {
      return "Connect a wallet to continue.";
    }

    if (!vaultAddress || !assetAddress) {
      return "Vault information is not available.";
    }

    if (!parsedAmount || parsedAmount === 0n) {
      return "Please enter a valid amount.";
    }

    if (mode === "deposit") {
      if (parsedAmount > userAssetBalance) {
        return `Insufficient ${assetSymbol} balance.`;
      }
    } else {
      if (!shareBalance || parsedAmount > shareBalance) {
        return "Insufficient vault shares to withdraw.";
      }
    }

    if (maxLossPercent < 0 || maxLossPercent > 100) {
      return "Max loss must be between 0% and 100%.";
    }

    return null;
  }, [
    userAddress,
    vaultAddress,
    assetAddress,
    parsedAmount,
    mode,
    userAssetBalance,
    assetSymbol,
    shareBalance,
    maxLossPercent,
  ]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setValidationError(null);

      const validationMessage = validate();
      if (validationMessage) {
        setValidationError(validationMessage);
        if (mode === "deposit") {
          resetDeposit();
        } else {
          resetWithdraw();
        }
        return;
      }

      if (!userAddress || !vaultAddress || !parsedAmount) {
        setValidationError("Missing required information. Please try again.");
        return;
      }

      if (mode === "deposit") {
        await deposit(parsedAmount, userAddress);
      } else {
        const maxLossBps = Math.floor(maxLossPercent * 100);
        await redeem(parsedAmount, userAddress, userAddress, maxLossBps);
      }

      // Refetch balance after transaction
      setTimeout(() => {
        refetchBalance();
      }, 2000);
    },
    [
      validate,
      mode,
      userAddress,
      vaultAddress,
      parsedAmount,
      maxLossPercent,
      deposit,
      redeem,
      resetDeposit,
      resetWithdraw,
      refetchBalance,
    ],
  );

  const handleMaxClick = useCallback(() => {
    if (mode === "deposit") {
      setInputAmount(formatUnits(userAssetBalance, assetDecimals));
    } else if (shareBalance) {
      setInputAmount(formatUnits(shareBalance, 18)); // Vault shares are typically 18 decimals
    }
  }, [mode, userAssetBalance, assetDecimals, shareBalance]);

  if (!open) {
    return null;
  }

  const modalTitle = mode === "deposit" ? `Deposit ${assetSymbol}` : `Withdraw ${assetSymbol}`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={modalTitle}
      showCloseButton
      className="max-w-lg bg-white text-slate-900"
    >
      <form className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700" onSubmit={handleSubmit}>
        {/* Amount Input */}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-slate-500">
                {mode === "deposit" ? `${assetSymbol} Amount` : "Shares to Redeem"}
              </span>
              <span className="text-xs text-slate-500">
                Balance:{" "}
                {mode === "deposit"
                  ? formatUnits(userAssetBalance, assetDecimals)
                  : shareBalance
                    ? formatVaultShares(shareBalance)
                    : "0"}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputAmount}
                onChange={(event) => setInputAmount(event.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                placeholder="0.00"
                required
              />
              <button
                type="button"
                onClick={handleMaxClick}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                MAX
              </button>
            </div>
          </label>

          {/* Preview */}
          {mode === "deposit" && expectedShares && (
            <div className="flex items-center justify-between rounded-lg bg-white p-3 text-sm">
              <span className="text-slate-500">Expected Shares:</span>
              <span className="font-medium text-slate-900">{formatVaultShares(expectedShares)}</span>
            </div>
          )}

          {mode === "withdraw" && expectedAssets && (
            <div className="flex items-center justify-between rounded-lg bg-white p-3 text-sm">
              <span className="text-slate-500">Expected {assetSymbol}:</span>
              <span className="font-medium text-slate-900">
                {formatUnits(expectedAssets, assetDecimals)}
              </span>
            </div>
          )}
        </section>

        {/* Max Loss Setting (for withdrawals) */}
        {mode === "withdraw" && (
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Max Loss Protection</h4>
              <p className="text-xs text-slate-500">
                Transaction will revert if loss exceeds this percentage
              </p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase text-slate-500">
                Max Loss Percentage
              </span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={maxLossPercent}
                onChange={(event) => setMaxLossPercent(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              />
              <span className="text-xs text-slate-500">
                Recommended: 1% for standard withdrawals
              </span>
            </label>
          </section>
        )}

        {/* Vault Info */}
        <section className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <h4 className="text-base font-semibold">Vault Information</h4>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-emerald-700">Asset:</span>
              <span className="font-medium">{assetSymbol}</span>
            </div>
            {mode === "withdraw" && assetValue && (
              <div className="flex justify-between">
                <span className="text-emerald-700">Your Position Value:</span>
                <span className="font-medium">{formatUnits(assetValue, assetDecimals)} {assetSymbol}</span>
              </div>
            )}
          </div>
        </section>

        {/* Validation Error Message */}
        {validationError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError}
          </p>
        )}

        {/* Transaction Error Message */}
        {state.status === "error" && state.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {/* Success Message */}
        {state.status === "success" && state.txHash && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Transaction successful!{" "}
            <a
              href={`https://basescan.org/tx/${state.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Basescan
            </a>
          </p>
        )}

        {/* Form Actions */}
        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            tabIndex={0}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
            disabled={isSubmitting || state.status === "success"}
            tabIndex={0}
            aria-label={mode === "deposit" ? "Deposit assets" : "Withdraw assets"}
          >
            {state.status === "approving"
              ? "Approving..."
              : state.status === "depositing"
                ? "Depositing..."
                : state.status === "redeeming"
                  ? "Withdrawing..."
                  : state.status === "success"
                    ? "Complete"
                    : mode === "deposit"
                      ? "Deposit"
                      : "Withdraw"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

