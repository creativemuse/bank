"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Address, formatUnits } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { useWallet, useAuth, EVMWallet } from "@crossmint/client-sdk-react-ui";
import { createWalletClient, custom, type WalletClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import {
  bigDecimal,
  evmAddress,
  useVaultDeposit,
  useVaultRedeemShares,
  useVaultDepositPreview,
  useVaultRedeemPreview,
} from "@aave/react";
import { useSendTransaction } from "@aave/react/viem";

import { Modal } from "@/components/common/Modal";
import { AAVE_TARGET_CHAIN_ID } from "@/lib/config/aave";

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
  const { data: wagmiWalletClient } = useWalletClient();
  const { wallet: crossmintWallet } = useWallet();
  const { status: authStatus } = useAuth();
  const { status: walletStatus } = useWallet();

  const walletClient = useMemo((): WalletClient | undefined => {
    if (crossmintWallet) {
      try {
        const evmWallet = EVMWallet.from(crossmintWallet);
        const chain = process.env.NODE_ENV === "production" ? base : baseSepolia;
        return createWalletClient({
          chain,
          transport: custom({
            async request({ method, params }) {
              if (method === "eth_sendTransaction" && params?.[0]) {
                const tx = params[0] as {
                  to?: string;
                  value?: string;
                  data?: string;
                };
                if (!tx.to) throw new Error("Transaction 'to' address is required");
                const valueBigInt = BigInt(tx.value || "0x0");
                const result = await evmWallet.sendTransaction({
                  to: tx.to as `0x${string}`,
                  value: valueBigInt,
                  data: (tx.data || "0x") as `0x${string}`,
                });
                return result.hash;
              }
              if (method === "eth_accounts" || method === "eth_requestAccounts") {
                return [crossmintWallet.address];
              }
              if (method === "eth_chainId") {
                return `0x${chain.id.toString(16)}`;
              }
              throw new Error(`Method ${method} not yet supported with Crossmint wallet adapter`);
            },
          }),
        });
      } catch (e) {
        console.error("Failed to create wallet client from Crossmint:", e);
      }
    }
    return wagmiWalletClient ?? undefined;
  }, [crossmintWallet, wagmiWalletClient]);

  const [deposit, depositState] = useVaultDeposit();
  const [redeem, redeemState] = useVaultRedeemShares();
  const [sendTransaction, sendState] = useSendTransaction(walletClient);
  const [depositPreview, depositPreviewState] = useVaultDepositPreview();
  const [redeemPreview, redeemPreviewState] = useVaultRedeemPreview();

  const [inputAmount, setInputAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expectedShares, setExpectedShares] = useState<string | null>(null);
  const [expectedAssets, setExpectedAssets] = useState<string | null>(null);

  const parsedAmount = useMemo(() => {
    if (!inputAmount || inputAmount === ".") return null;
    const num = Number.parseFloat(inputAmount);
    if (Number.isNaN(num) || num <= 0) return null;
    return num;
  }, [inputAmount]);

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
    if (mode === "withdraw" && parsedAmount != null) {
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
    } else {
      setExpectedAssets(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- redeemPreview is stable from hook
  }, [mode, parsedAmount, vaultAddress]);

  const isSubmitting =
    depositState.loading || redeemState.loading || sendState.loading;

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
      const sharesWei = BigInt(Math.floor(parsedAmount * 1e18));
      if (shareBalance < sharesWei) return "Insufficient vault shares.";
    }
    return null;
  }, [
    userAddress,
    parsedAmount,
    mode,
    isBalanceLoading,
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

      if (!walletClient || !userAddress || parsedAmount == null) {
        setErrorMessage("Wallet or amount not ready.");
        return;
      }

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

        let sendResult;
        if (plan.__typename === "TransactionRequest") {
          sendResult = await sendTransaction(plan);
        } else {
          const approvalResult = await sendTransaction(plan.approval);
          if (approvalResult.isErr()) {
            setErrorMessage(
              (approvalResult.error as Error)?.message ?? "Approval failed",
            );
            return;
          }
          sendResult = await sendTransaction(plan.originalTransaction);
        }

        if (sendResult.isErr()) {
          setErrorMessage(
            (sendResult.error as Error)?.message ?? "Transaction failed",
          );
          return;
        }
      } else {
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

        const sendResult = await sendTransaction(redeemResult.value);
        if (sendResult.isErr()) {
          setErrorMessage(
            (sendResult.error as Error)?.message ?? "Withdraw failed",
          );
          return;
        }
      }

      resetForm();
      onSuccess?.();
      handleClose();
    },
    [
      validate,
      mode,
      walletClient,
      userAddress,
      parsedAmount,
      vaultAddress,
      deposit,
      redeem,
      sendTransaction,
      assetSymbol,
      onSuccess,
      handleClose,
      resetForm,
    ],
  );

  const handleMaxClick = useCallback(() => {
    if (mode === "deposit" && userAssetBalance !== undefined) {
      setInputAmount(formatUnits(userAssetBalance, assetDecimals));
    } else if (mode === "withdraw" && shareBalance !== undefined) {
      setInputAmount(formatUnits(shareBalance, 18));
    }
  }, [mode, userAssetBalance, shareBalance, assetDecimals]);

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
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-slate-500">
                {mode === "deposit" ? `${assetSymbol} Amount` : "Shares to Redeem"}
              </span>
              <span className="text-xs text-slate-500">
                Balance:{" "}
                {mode === "deposit"
                  ? isBalanceLoading
                    ? "Loading..."
                    : formatUnits(userAssetBalance, assetDecimals)
                  : formatUnits(shareBalance, 18)}
              </span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.00"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              aria-label={mode === "deposit" ? "Amount to deposit" : "Shares to redeem"}
            />
            <button
              type="button"
              onClick={handleMaxClick}
              className="self-end text-xs font-medium text-slate-600 underline hover:text-slate-800"
            >
              Max
            </button>
            {mode === "deposit" && expectedShares != null && (
              <p className="text-xs text-slate-500">
                You will receive approximately {expectedShares} vault shares
              </p>
            )}
            {mode === "withdraw" && expectedAssets != null && (
              <p className="text-xs text-slate-500">
                You will receive approximately {expectedAssets} {assetSymbol}
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
