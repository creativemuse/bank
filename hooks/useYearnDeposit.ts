"use client";

import { useState, useCallback, useMemo } from "react";
import { useWriteContract, useReadContract, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { Address, type WalletClient } from "viem";
import { encodeFunctionData } from "viem";
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
 * Supports both Crossmint wallet and wagmi wallet
 */
export const useYearnDeposit = (
  vaultAddress: Address | undefined,
  assetAddress: Address | undefined,
  walletClient?: WalletClient,
): UseYearnDepositReturn => {
  const [state, setState] = useState<DepositState>({ status: "idle" });
  const { address: wagmiAddress } = useAccount();
  const { wallet: crossmintWallet } = useWallet();
  const publicClient = usePublicClient();
  const { data: wagmiWalletClient } = useWalletClient();

  // Determine active address (Crossmint takes priority, fallback to wagmi)
  // This must match the logic in YearnVaultModal to ensure we use the correct address
  const ownerAddress = useMemo(() => {
    if (crossmintWallet?.address) {
      return crossmintWallet.address as `0x${string}`;
    }
    return wagmiAddress;
  }, [crossmintWallet?.address, wagmiAddress]);

  // Use provided wallet client, fallback to wagmi wallet client
  const activeWalletClient = walletClient || wagmiWalletClient;

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

          let approveHash: `0x${string}`;

          // Use custom wallet client if provided (Crossmint), otherwise use wagmi
          if (activeWalletClient) {
            // Encode the function data
            const data = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [vaultAddress, assets],
            });
            
            // Get account from wallet client
            const accounts = await activeWalletClient.getAddresses();
            const account = accounts[0];
            
            if (!account) {
              throw new Error("No account available in wallet");
            }
            
            // Send transaction using wallet client
            approveHash = await activeWalletClient.sendTransaction({
              account,
              to: assetAddress,
              data,
              chain: activeWalletClient.chain || null,
            });
          } else {
            const hash = await writeApprove({
              address: assetAddress,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [vaultAddress, assets],
              chainId: 8453,
            });
            if (!hash) {
              throw new Error("Approval transaction failed");
            }
            approveHash = hash;
          }

          // Wait for approval to be mined
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({
              hash: approveHash,
              timeout: 120_000, // 2 minute timeout
            });
          }

          // Refetch allowance after approval
          await refetchAllowance();
        }

        // Step 2: Execute deposit
        setState({ status: "depositing" });

        let depositHash: `0x${string}`;

        // Use custom wallet client if provided (Crossmint), otherwise use wagmi
        if (activeWalletClient) {
          // Encode the function data
          const data = encodeFunctionData({
            abi: ERC4626_ABI,
            functionName: "deposit",
            args: [assets, receiver],
          });
          
          // Get account from wallet client
          const accounts = await activeWalletClient.getAddresses();
          const account = accounts[0];
          
          if (!account) {
            throw new Error("No account available in wallet");
          }
          
          // Send transaction using wallet client
          depositHash = await activeWalletClient.sendTransaction({
            account,
            to: vaultAddress,
            data,
            chain: activeWalletClient.chain || null,
          });
        } else {
          const hash = await writeDeposit({
            address: vaultAddress,
            abi: ERC4626_ABI,
            functionName: "deposit",
            args: [assets, receiver],
            chainId: 8453,
          });
          if (!hash) {
            throw new Error("Deposit transaction failed");
          }
          depositHash = hash;
        }

        // Wait for deposit to be mined
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: depositHash,
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
      activeWalletClient,
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

