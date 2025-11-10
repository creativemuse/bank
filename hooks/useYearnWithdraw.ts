"use client";

import { useState, useCallback } from "react";
import { useWriteContract } from "wagmi";
import { Address } from "viem";
import { ERC4626_ABI, MAX_LOSS_BPS } from "@/lib/config/yearn";

type WithdrawState = {
  status: "idle" | "redeeming" | "success" | "error";
  txHash?: string;
  error?: string;
};

type UseYearnWithdrawReturn = {
  redeem: (shares: bigint, receiver: Address, owner: Address, maxLossBps?: number) => Promise<void>;
  state: WithdrawState;
  reset: () => void;
};

/**
 * Hook to handle Yearn V3 vault withdrawals using the redeem function
 * Recommended over withdraw function per Yearn V3 best practices
 * 
 * @param vaultAddress - Address of the Yearn V3 vault
 * @param maxLossBps - Maximum loss in basis points (default: 10000 = 100%)
 */
export const useYearnWithdraw = (
  vaultAddress: Address | undefined,
): UseYearnWithdrawReturn => {
  const [state, setState] = useState<WithdrawState>({ status: "idle" });

  const { writeContractAsync: writeRedeem } = useWriteContract();

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const redeem = useCallback(
    async (
      shares: bigint,
      receiver: Address,
      owner: Address,
      maxLossBps: number = MAX_LOSS_BPS.UNLIMITED,
    ) => {
      if (!vaultAddress) {
        setState({
          status: "error",
          error: "Vault address not provided",
        });
        return;
      }

      try {
        setState({ status: "redeeming" });

        // Use the V3-specific redeem function with maxLoss parameter
        // This is recommended by Yearn for final withdrawal steps
        const redeemHash = await writeRedeem({
          address: vaultAddress,
          abi: ERC4626_ABI,
          functionName: "redeem",
          args: [shares, receiver, owner, BigInt(maxLossBps)],
          chainId: 8453,
        });

        if (!redeemHash) {
          throw new Error("Redeem transaction failed");
        }

        setState({
          status: "success",
          txHash: redeemHash,
        });
      } catch (error) {
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Withdrawal failed",
        });
      }
    },
    [vaultAddress, writeRedeem],
  );

  return {
    redeem,
    state,
    reset,
  };
};

/**
 * Hook to handle Yearn V3 vault withdrawals using the withdraw function
 * Note: redeem is recommended over withdraw, but this is provided for completeness
 * 
 * @param vaultAddress - Address of the Yearn V3 vault
 * @param maxLossBps - Maximum loss in basis points (default: 0 = 0%)
 */
export const useYearnWithdrawAssets = (
  vaultAddress: Address | undefined,
): UseYearnWithdrawReturn => {
  const [state, setState] = useState<WithdrawState>({ status: "idle" });

  const { writeContractAsync: writeWithdraw } = useWriteContract();

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const redeem = useCallback(
    async (
      assets: bigint,
      receiver: Address,
      owner: Address,
      maxLossBps: number = MAX_LOSS_BPS.NONE,
    ) => {
      if (!vaultAddress) {
        setState({
          status: "error",
          error: "Vault address not provided",
        });
        return;
      }

      try {
        setState({ status: "redeeming" });

        const withdrawHash = await writeWithdraw({
          address: vaultAddress,
          abi: ERC4626_ABI,
          functionName: "withdraw",
          args: [assets, receiver, owner, BigInt(maxLossBps)],
          chainId: 8453,
        });

        if (!withdrawHash) {
          throw new Error("Withdraw transaction failed");
        }

        setState({
          status: "success",
          txHash: withdrawHash,
        });
      } catch (error) {
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Withdrawal failed",
        });
      }
    },
    [vaultAddress, writeWithdraw],
  );

  return {
    redeem,
    state,
    reset,
  };
};

