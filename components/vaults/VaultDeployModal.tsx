"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import {
  bigDecimal,
  evmAddress,
  useVaultDeploy,
  type Market,
  type Reserve,
  type VaultDeployRequest,
} from "@aave/react";
import { useWalletClient, useAccount } from "wagmi";
import { useSendTransaction } from "@aave/react/viem";

import { Modal } from "@/components/common/Modal";
import { USDC_DECIMALS } from "@/lib/config/aave";
import { formatPercent } from "@/lib/formatters";

type VaultDeployModalProps = {
  open: boolean;
  onClose: () => void;
  market?: Market;
  reserve?: Reserve;
};

type RecipientInput = {
  partnerAddress?: string;
  partnerPercent: number;
};

type SubmitState = {
  status: "idle" | "approval" | "deploying" | "success" | "error";
  message?: string;
  txHash?: string;
};

export function VaultDeployModal({ open, onClose, market, reserve }: VaultDeployModalProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [deployVault, deployState] = useVaultDeploy();
  const [sendTransaction, sendTransactionState] = useSendTransaction(walletClient);

  const [shareName, setShareName] = useState("Aave USDC Vault Shares");
  const [shareSymbol, setShareSymbol] = useState("avUSDC");
  const [performanceFee, setPerformanceFee] = useState(12);
  const [initialDeposit, setInitialDeposit] = useState(1000);
  const [recipientInput, setRecipientInput] = useState<RecipientInput>({
    partnerAddress: "",
    partnerPercent: 0,
  });
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const reserveApy = formatPercent(reserve?.supplyInfo.apy?.formatted);

  const isSubmitting =
    deployState.loading || sendTransactionState.loading || submitState.status === "deploying";

  const resetForm = useCallback(() => {
    setSubmitState({ status: "idle" });
    setPerformanceFee(12);
    setInitialDeposit(1000);
    setRecipientInput({ partnerAddress: "", partnerPercent: 0 });
    setShareName("Aave USDC Vault Shares");
    setShareSymbol("avUSDC");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = useCallback(() => {
    if (!address) {
      return "Connect a wallet to deploy a vault.";
    }

    if (!market || !reserve) {
      return "Reserve data is still loading. Please try again in a moment.";
    }

    if (Number.isNaN(performanceFee) || performanceFee < 10 || performanceFee > 50) {
      return "Performance fee must be between 10% and 50%.";
    }

    if (Number.isNaN(initialDeposit) || initialDeposit < 0) {
      return "Initial deposit must be zero or a positive number.";
    }

    if (
      recipientInput.partnerPercent < 0 ||
      recipientInput.partnerPercent > 100 ||
      Number.isNaN(recipientInput.partnerPercent)
    ) {
      return "Partner revenue share must be between 0% and 100%.";
    }

    return null;
  }, [address, initialDeposit, market, performanceFee, recipientInput.partnerPercent, reserve]);

  const recipients = useMemo(() => {
    const entries: VaultDeployRequest["recipients"] = [];

    const partnerAddress = recipientInput.partnerAddress?.trim();
    const trimmed = partnerAddress && partnerAddress.length > 0 ? partnerAddress : null;

    if (trimmed && recipientInput.partnerPercent > 0) {
      entries.push({
        address: evmAddress(trimmed),
        percent: bigDecimal(recipientInput.partnerPercent),
      });
    }

    const ownerSplit = 100 - recipientInput.partnerPercent;
    if (ownerSplit > 0) {
      entries.push({
        address: evmAddress(address ?? "0x0000000000000000000000000000000000000000"),
        percent: bigDecimal(ownerSplit),
      });
    }

    return entries.length ? entries : undefined;
  }, [address, recipientInput.partnerAddress, recipientInput.partnerPercent]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const validationMessage = validate();
      if (validationMessage) {
        setSubmitState({ status: "error", message: validationMessage });
        return;
      }

      if (!walletClient) {
        setSubmitState({
          status: "error",
          message: "Unable to access wallet client. Please reconnect your wallet.",
        });
        return;
      }

      if (!market || !reserve || !address) {
        setSubmitState({
          status: "error",
          message: "Missing context to deploy vault. Please try again.",
        });
        return;
      }

      setSubmitState({ status: "deploying" });

      const request: VaultDeployRequest = {
        market: evmAddress(market.address),
        chainId: market.chain.chainId,
        underlyingToken: evmAddress(reserve.underlyingToken.address),
        deployer: evmAddress(address),
        shareName,
        shareSymbol,
        initialFee: bigDecimal(performanceFee),
        initialLockDeposit: bigDecimal(initialDeposit),
        recipients,
      };

      const planResult = await deployVault(request);
      if (planResult.isErr()) {
        setSubmitState({ status: "error", message: planResult.error.message });
        return;
      }

      const plan = planResult.value;

      if (plan.__typename === "InsufficientBalanceError") {
        setSubmitState({
          status: "error",
          message: `Insufficient balance. Required: ${plan.required.value} USDC.`,
        });
        return;
      }

      let transactionResult = null;

      if (plan.__typename === "TransactionRequest") {
        transactionResult = await sendTransaction(plan);
      } else if (plan.__typename === "ApprovalRequired") {
        setSubmitState({ status: "approval" });
        const approvalResult = await sendTransaction(plan.approval);
        if (approvalResult.isErr()) {
          setSubmitState({
            status: "error",
            message: approvalResult.error.message,
          });
          return;
        }

        setSubmitState({ status: "deploying" });
        transactionResult = await sendTransaction(plan.originalTransaction);
      } else {
        setSubmitState({
          status: "error",
          message: "Unsupported execution plan returned by Aave SDK.",
        });
        return;
      }

      if (transactionResult.isErr()) {
        setSubmitState({
          status: "error",
          message: transactionResult.error.message,
        });
        return;
      }

      setSubmitState({
        status: "success",
        txHash: transactionResult.value,
        message: "Vault deployment transaction submitted successfully.",
      });
    },
    [
      address,
      deployVault,
      initialDeposit,
      market,
      performanceFee,
      recipients,
      reserve,
      sendTransaction,
      shareName,
      shareSymbol,
      validate,
      walletClient,
    ],
  );

  if (!open) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Deploy Aave USDC Vault"
      showCloseButton
      className="max-w-2xl bg-white text-slate-900"
    >
      <form
        className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700"
        onSubmit={handleSubmit}
      >
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-base font-semibold text-slate-900">Vault Configuration</h4>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-slate-500">Share Name</span>
            <input
              value={shareName}
              onChange={(event) => setShareName(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder="Aave USDC Vault Shares"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-slate-500">Share Symbol</span>
            <input
              value={shareSymbol}
              onChange={(event) => setShareSymbol(event.target.value.toUpperCase())}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder="avUSDC"
              required
            />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-slate-500">Performance Fee</span>
              <input
                type="number"
                step="0.1"
                min={10}
                max={50}
                value={performanceFee}
                onChange={(event) => setPerformanceFee(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                required
              />
              <span className="text-xs text-slate-500">
                Minimum 10%. Aave Labs automatically receives 50% of this fee.
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-slate-500">
                Initial Deposit (USDC)
              </span>
              <input
                type="number"
                min={0}
                step={1 / 10 ** USDC_DECIMALS}
                value={initialDeposit}
                onChange={(event) => setInitialDeposit(Number(event.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                required
              />
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Revenue Share</h4>
            <p className="text-xs text-slate-500">
              Optionally split your share of the performance fees with a partner.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-slate-500">Partner Address</span>
            <input
              value={recipientInput.partnerAddress}
              onChange={(event) =>
                setRecipientInput((previous) => ({
                  ...previous,
                  partnerAddress: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder="0x..."
            />
          </label>
          <label className="flex flex-col gap-1 md:w-1/2">
            <span className="text-xs font-medium uppercase text-slate-500">
              Partner Share (% of your portion)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={recipientInput.partnerPercent}
              onChange={(event) =>
                setRecipientInput((previous) => ({
                  ...previous,
                  partnerPercent: Number(event.target.value),
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            />
            <span className="text-xs text-slate-500">
              Remaining split automatically allocated to your wallet.
            </span>
          </label>
        </section>

        {reserve ? (
          <section className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <h4 className="text-base font-semibold">Underlying Reserve</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="flex flex-col">
                <span className="text-xs uppercase text-emerald-700">Market</span>
                <span className="font-medium">{reserve.market.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase text-emerald-700">Supply APR</span>
                <span className="font-medium">{reserveApy}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase text-emerald-700">Underlying Token</span>
                <span className="font-medium">{reserve.underlyingToken.symbol}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase text-emerald-700">aToken</span>
                <span className="font-medium">{reserve.aToken.symbol}</span>
              </div>
            </div>
          </section>
        ) : null}

        {submitState.status === "error" && submitState.message ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitState.message}
          </p>
        ) : null}

        {submitState.status === "success" && submitState.message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {submitState.message}
            {submitState.txHash ? (
              <>
                {" "}
                <a
                  href={`https://basescan.org/tx/${submitState.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View on Basescan
                </a>
              </>
            ) : null}
          </p>
        ) : null}

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
            disabled={isSubmitting}
            tabIndex={0}
            aria-label="Deploy vault"
          >
            {submitState.status === "approval"
              ? "Confirming Approval..."
              : isSubmitting
                ? "Deploying..."
                : "Deploy Vault"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

