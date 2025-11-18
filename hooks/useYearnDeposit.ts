"use client";

import { useState, useCallback } from "react";
import { useWriteContract, useReadContract, useAccount, usePublicClient } from "wagmi";
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
  const { address: ownerAddress } = useAccount();
  const publicClient = usePublicClient();

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeDeposit } = useWriteContract();

  // Check current allowance - allowance(owner, spender)
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      vaultAddress && assetAddress && ownerAddress
        ? [ownerAddress, vaultAddress]
        : undefined,
    query: {
      enabled: !!vaultAddress && !!assetAddress && !!ownerAddress,
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

      if (!ownerAddress) {
        setState({
          status: "error",
          error: "Wallet not connected",
        });
        return;
      }

      try {
        // Step 1: Check and handle approval if needed
        const { data: newAllowance } = await refetchAllowance();
        const allowance = (newAllowance as bigint) ?? 0n;

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
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({
              hash: approveHash as `0x${string}`,
              timeout: 120_000, // 2 minute timeout
            });
          }

          // Refetch allowance after approval
          await refetchAllowance();
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

        // Wait for deposit to be mined
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: depositHash as `0x${string}`,
            timeout: 120_000, // 2 minute timeout
          });
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
      ownerAddress,
      currentAllowance,
      writeApprove,
      writeDeposit,
      refetchAllowance,
      publicClient,
    ],
  );

  return {
    deposit,
    state,
    reset,
  };
};

