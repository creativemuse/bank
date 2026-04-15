"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useAccount, useWalletClient, useReadContract } from "wagmi";
import { useWallet, EVMWallet } from "@crossmint/client-sdk-react-ui";
import { createWalletClient, custom, encodeFunctionData, type WalletClient, type Address, formatUnits } from "viem";
import { base, baseSepolia } from "viem/chains";
import { bigDecimal, chainId as aaveChainId, evmAddress, useVaultSetFee, useVaultWithdrawFees, useVaultTransferOwnership } from "@aave/react";
import { useSendTransaction } from "@aave/react/viem";
import type { Vault } from "@aave/react";

// ABI for direct contract calls (fallback when Aave API is unavailable)
const VAULT_MGMT_ABI = [
  {
    inputs: [],
    name: "getClaimableFees",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "recipient", type: "address" }],
    name: "claimRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "withdrawFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

import { Modal } from "@/components/common/Modal";

type VaultManagementModalProps = {
  open: boolean;
  onClose: () => void;
  vault: Vault;
  onSuccess?: () => void;
};

type TabId = "fee" | "withdraw-fees" | "transfer";

export function VaultManagementModal({ open, onClose, vault, onSuccess }: VaultManagementModalProps) {
  const { data: wagmiWalletClient } = useWalletClient();
  const { wallet: crossmintWallet } = useWallet();

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
                const tx = params[0] as { to?: string; value?: string; data?: string };
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

  const [setFee, setFeeState] = useVaultSetFee();
  const [withdrawFees, withdrawFeesState] = useVaultWithdrawFees();
  const [transferOwnership, transferState] = useVaultTransferOwnership();
  const [sendTransaction, sendState] = useSendTransaction(walletClient);

  const [activeTab, setActiveTab] = useState<TabId>("fee");
  const [feeInput, setFeeInput] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMax, setWithdrawMax] = useState(false);
  const [newOwnerAddress, setNewOwnerAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [directTxLoading, setDirectTxLoading] = useState(false);

  // On-chain fee reads (works even when Aave API is down)
  const { data: onChainFee } = useReadContract({
    address: vault.address as Address,
    abi: VAULT_MGMT_ABI,
    functionName: "getFee",
    chainId: 8453,
  });
  const { data: onChainClaimableFees, refetch: refetchClaimable } = useReadContract({
    address: vault.address as Address,
    abi: VAULT_MGMT_ABI,
    functionName: "getClaimableFees",
    chainId: 8453,
    query: { refetchInterval: 15000 },
  });

  const chainId = aaveChainId(Number(vault.chainId));

  // Use API data when available, fall back to on-chain reads
  const currentFee = vault.fee?.formatted
    ?? (onChainFee != null ? (Number(onChainFee) / 1e18 * 100).toFixed(0) : "—");
  const claimableFeesRaw = onChainClaimableFees != null
    ? formatUnits(onChainClaimableFees as bigint, 6)
    : null;
  const feesBalanceValue = vault.feesBalance?.amount?.value ?? claimableFeesRaw ?? "0";
  const totalFeeRevenueValue = vault.totalFeeRevenue?.amount?.value ?? "0";

  const isBusy =
    setFeeState.loading ||
    withdrawFeesState.loading ||
    transferState.loading ||
    sendState.loading ||
    directTxLoading;

  const handleSetFee = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      const parsed = Number.parseFloat(feeInput);
      if (Number.isNaN(parsed) || parsed < 10 || parsed > 100) {
        setErrorMessage("Fee must be between 10 and 100%");
        return;
      }
      if (!walletClient) {
        setErrorMessage("Wallet not connected");
        return;
      }
      let result;
      try {
        result = await setFee({
          chainId,
          vault: evmAddress(vault.address),
          newFee: bigDecimal(parsed),
        }).andThen(sendTransaction);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg.includes("Service panicked")
          ? "The Aave API is temporarily unavailable. Please try again in a few minutes."
          : `Set fee failed: ${msg}`);
        return;
      }
      if (result.isErr()) {
        setErrorMessage(result.error?.message ?? "Set fee failed");
        return;
      }
      onSuccess?.();
      onClose();
    },
    [feeInput, walletClient, chainId, vault.address, setFee, sendTransaction, onSuccess, onClose],
  );

  const handleWithdrawFees = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      if (!walletClient) {
        setErrorMessage("Wallet not connected");
        return;
      }
      const amount = withdrawMax
        ? { max: true as const }
        : { exact: bigDecimal(withdrawAmount) };

      const userAddr = crossmintWallet?.address ?? (await walletClient.getAddresses())?.[0];

      // ── Layer 1: Aave SDK hooks (normal path) ──
      console.log("[VaultManagement] Layer 1: Trying Aave SDK useVaultWithdrawFees…");
      let result;
      try {
        result = await withdrawFees({
          chainId,
          vault: evmAddress(vault.address),
          amount,
        }).andThen(sendTransaction);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!(msg.includes("Service panicked") || msg.includes("InvariantError"))) {
          setErrorMessage(`Withdraw fees failed: ${msg}`);
          return;
        }
        console.warn("[VaultManagement] Layer 1 failed (API panic). Trying Layer 2…");

        // ── Layer 2: Direct GraphQL query (bypass stale hook cache) ──
        try {
          setDirectTxLoading(true);
          console.log("[VaultManagement] Layer 2: Trying direct GraphQL vaultWithdrawFees query…");
          const gqlAmount = withdrawMax ? "{ max: true }" : `{ exact: "${withdrawAmount}" }`;
          const gqlResponse = await fetch("/api/aave/graphql", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              query: `{ vaultWithdrawFees(request: { chainId: 8453, vault: "${vault.address}", amount: ${gqlAmount} }) { to from data value chainId } }`,
            }),
          });
          const gqlData = await gqlResponse.json();
          const txRequest = gqlData?.data?.vaultWithdrawFees;
          if (txRequest?.to && txRequest?.data) {
            console.log("[VaultManagement] Layer 2: Got TransactionRequest, sending…");
            const hash = await walletClient.sendTransaction({
              to: txRequest.to as Address,
              data: txRequest.data as `0x${string}`,
              value: BigInt(txRequest.value || "0"),
              chain: base,
              account: userAddr as Address,
            });
            console.log("[VaultManagement] Layer 2 success:", hash);
            await refetchClaimable();
            onSuccess?.();
            onClose();
            return;
          }
          console.warn("[VaultManagement] Layer 2 failed (no valid response). Trying Layer 3…", gqlData);
        } catch (gqlErr) {
          console.warn("[VaultManagement] Layer 2 failed:", gqlErr);
        }

        // ── Layer 3: Direct withdrawFees(address,uint256) via Crossmint SDK ──
        try {
          console.log("[VaultManagement] Layer 3: Trying withdrawFees(address,uint256) via Crossmint…");
          if (!userAddr) {
            setErrorMessage("Could not determine wallet address");
            return;
          }
          const claimable = onChainClaimableFees as bigint | undefined;
          if (!claimable || claimable === 0n) {
            setErrorMessage("No fees available to withdraw.");
            return;
          }
          if (crossmintWallet) {
            const evmWallet = EVMWallet.from(crossmintWallet);
            const txResult = await evmWallet.sendTransaction({
              to: vault.address as `0x${string}`,
              abi: VAULT_MGMT_ABI,
              functionName: "withdrawFees",
              args: [userAddr as `0x${string}`, claimable],
            });
            console.log("[VaultManagement] Layer 3 success:", txResult.hash);
          } else {
            const data = encodeFunctionData({
              abi: VAULT_MGMT_ABI,
              functionName: "withdrawFees",
              args: [userAddr as Address, claimable],
            });
            const hash = await walletClient.sendTransaction({
              to: vault.address as Address, data, chain: base, account: userAddr as Address,
            });
            console.log("[VaultManagement] Layer 3 success:", hash);
          }
          await refetchClaimable();
          onSuccess?.();
          onClose();
          return;
        } catch (l3Err) {
          console.warn("[VaultManagement] Layer 3 failed:", l3Err);
        }

        // ── Layer 4: Direct claimRewards(address) via Crossmint SDK ──
        try {
          console.log("[VaultManagement] Layer 4: Trying claimRewards(address) via Crossmint…");
          if (crossmintWallet) {
            const evmWallet = EVMWallet.from(crossmintWallet);
            const txResult = await evmWallet.sendTransaction({
              to: vault.address as `0x${string}`,
              abi: VAULT_MGMT_ABI,
              functionName: "claimRewards",
              args: [userAddr as `0x${string}`],
            });
            console.log("[VaultManagement] Layer 4 success:", txResult.hash);
          } else {
            const data = encodeFunctionData({
              abi: VAULT_MGMT_ABI,
              functionName: "claimRewards",
              args: [userAddr as Address],
            });
            const hash = await walletClient.sendTransaction({
              to: vault.address as Address, data, chain: base, account: userAddr as Address,
            });
            console.log("[VaultManagement] Layer 4 success:", hash);
          }
          await refetchClaimable();
          onSuccess?.();
          onClose();
          return;
        } catch (l4Err) {
          const l4Msg = l4Err instanceof Error ? l4Err.message : String(l4Err);
          console.warn("[VaultManagement] Layer 4 failed:", l4Msg);

          // ── Layer 5: All fallbacks exhausted — show instructions ──
          setErrorMessage(
            "All fee withdrawal methods failed. The Aave API is currently down, and Crossmint's " +
            "transaction simulation doesn't support owner-gated vault calls yet. " +
            "You can try withdrawing directly on Basescan: " +
            `https://basescan.org/address/${vault.address}#writeProxyContract`
          );
        } finally {
          setDirectTxLoading(false);
        }
        return;
      }

      if (result.isErr()) {
        setErrorMessage(result.error?.message ?? "Withdraw fees failed");
        return;
      }
      onSuccess?.();
      onClose();
    },
    [withdrawMax, withdrawAmount, walletClient, crossmintWallet, chainId, vault.address,
      withdrawFees, sendTransaction, onChainClaimableFees, refetchClaimable, onSuccess, onClose],
  );

  const handleTransferOwnership = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);
      const trimmed = newOwnerAddress.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        setErrorMessage("Enter a valid Ethereum address (0x...)");
        return;
      }
      if (!walletClient) {
        setErrorMessage("Wallet not connected");
        return;
      }
      let result;
      try {
        result = await transferOwnership({
          chainId,
          vault: evmAddress(vault.address),
          newOwner: evmAddress(trimmed),
        }).andThen(sendTransaction);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg.includes("Service panicked")
          ? "The Aave API is temporarily unavailable. Please try again in a few minutes."
          : `Transfer ownership failed: ${msg}`);
        return;
      }
      if (result.isErr()) {
        setErrorMessage(result.error?.message ?? "Transfer ownership failed");
        return;
      }
      onSuccess?.();
      onClose();
    },
    [newOwnerAddress, walletClient, chainId, vault.address, transferOwnership, sendTransaction, onSuccess, onClose],
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "fee", label: "Set fee" },
    { id: "withdraw-fees", label: "Withdraw fees" },
    { id: "transfer", label: "Transfer ownership" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage vault"
      showCloseButton
      className="max-w-2xl bg-white text-slate-900"
    >
      <div className="mt-6 flex w-full flex-col gap-5 text-sm text-slate-700">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-base font-semibold text-slate-900">Vault summary</h4>
          <p className="text-sm text-slate-600">
            Current fee: <strong>{currentFee}%</strong> · Fees balance: <strong>{feesBalanceValue}</strong> · Total fee revenue: <strong>{totalFeeRevenueValue}</strong>
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-label={`${tab.label} tab`}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 ${
                  activeTab === tab.id
                    ? "border border-slate-900 bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrorMessage(null);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          )}

          {activeTab === "fee" && (
            <form onSubmit={handleSetFee} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-slate-500">New performance fee (%)</span>
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={1}
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  placeholder="e.g. 15"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  aria-label="New fee percentage"
                />
              </label>
              <p className="text-xs text-slate-500">Minimum 10%. Aave Labs retains 50% of the fee.</p>
              <button
                type="submit"
                disabled={isBusy || !feeInput}
                className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
              >
                {setFeeState.loading || sendState.loading ? "Processing…" : "Set fee"}
              </button>
            </form>
          )}

          {activeTab === "withdraw-fees" && (
            <form onSubmit={handleWithdrawFees} className="flex flex-col gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={withdrawMax}
                  onChange={(e) => {
                    setWithdrawMax(e.target.checked);
                    if (e.target.checked) setWithdrawAmount("");
                  }}
                  className="rounded border-slate-300 focus:ring-slate-500"
                  aria-label="Withdraw maximum"
                />
                <span className="text-sm font-medium text-slate-700">Withdraw max</span>
              </label>
              {!withdrawMax && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-slate-500">Amount to withdraw</span>
                  <input
                    type="text"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Amount to withdraw"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                    aria-label="Withdraw amount"
                  />
                </label>
              )}
              <p className="text-xs text-slate-500">Withdrawn fees are received as aTokens.</p>
              <button
                type="submit"
                disabled={isBusy || (!withdrawMax && !withdrawAmount.trim())}
                className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
              >
                {withdrawFeesState.loading || sendState.loading || directTxLoading ? "Processing…" : "Withdraw fees"}
              </button>
            </form>
          )}

          {activeTab === "transfer" && (
            <form onSubmit={handleTransferOwnership} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-slate-500">New owner address</span>
                <input
                  type="text"
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  placeholder="0x..."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  aria-label="New owner address"
                />
              </label>
              <p className="text-xs text-slate-500">This action is irreversible. You will lose owner privileges.</p>
              <button
                type="submit"
                disabled={isBusy || !newOwnerAddress.trim()}
                className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:border-slate-700 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
              >
                {transferState.loading || sendState.loading ? "Processing…" : "Transfer ownership"}
              </button>
            </form>
          )}
        </section>
      </div>
    </Modal>
  );
}
