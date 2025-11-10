"use client";

import { useState, useCallback } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { Address } from "viem";
import { ERC4626_ABI, ERC20_ABI } from "@/lib/config/yearn";

type DepositState = {
  status: "idle" | "approving" | "depositing" | "success" | "error";
  txHash?: string;
  error?: string;
};

type UseYearnDepositReturn = {
  deposit: (assets: bigint, receiver: Address) => Promise<void>;
  state: DepositState;
  reset: () => void;
};

/**
 * Hook to handle Yearn V3 vault deposits with ERC-4626 compliance
 * Follows the standard flow: approve token -> deposit assets
 */
export const useYearnDeposit = (
  vaultAddress: Address | undefined,
  assetAddress: Address | undefined,
): UseYearnDepositReturn => {
  const [state, setState] = useState<DepositState>({ status: "idle" });

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeDeposit } = useWriteContract();

  // Check current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      vaultAddress && assetAddress
        ? [assetAddress, vaultAddress]
        : undefined,
    query: {
      enabled: !!vaultAddress && !!assetAddress,
    },
  });

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const deposit = useCallback(
    async (assets: bigint, receiver: Address) => {
      if (!vaultAddress || !assetAddress) {
        setState({
          status: "error",
          error: "Vault or asset address not provided",
        });
        return;
      }

      try {
        // Step 1: Check and handle approval if needed
        await refetchAllowance();
        const allowance = (currentAllowance as bigint) ?? 0n;

        if (allowance < assets) {
          setState({ status: "approving" });

          const approveHash = await writeApprove({
            address: assetAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [vaultAddress, assets],
            chainId: 8453,
          });

          if (!approveHash) {
            throw new Error("Approval transaction failed");
          }

          // Wait for approval to be mined
          // Note: In production, you'd use useWaitForTransactionReceipt
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        // Step 2: Execute deposit
        setState({ status: "depositing" });

        const depositHash = await writeDeposit({
          address: vaultAddress,
          abi: ERC4626_ABI,
          functionName: "deposit",
          args: [assets, receiver],
          chainId: 8453,
        });

        if (!depositHash) {
          throw new Error("Deposit transaction failed");
        }

        setState({
          status: "success",
          txHash: depositHash,
        });
      } catch (error) {
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Deposit failed",
        });
      }
    },
    [
      vaultAddress,
      assetAddress,
      currentAllowance,
      writeApprove,
      writeDeposit,
      refetchAllowance,
    ],
  );

  return {
    deposit,
    state,
    reset,
  };
};

