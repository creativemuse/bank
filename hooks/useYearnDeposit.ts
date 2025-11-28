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
        // Pre-deposit validation: Check maxDeposit before attempting
        if (publicClient && vaultAddress && receiver) {
          try {
            const maxDeposit = await publicClient.readContract({
              address: vaultAddress,
              abi: ERC4626_ABI,
              functionName: "maxDeposit",
              args: [receiver],
            });

            if (maxDeposit < assets) {
              const maxDepositFormatted = maxDeposit === 0n 
                ? "0 (vault may be paused or at capacity)"
                : `${Number(maxDeposit) / 1e6} USDC`;
              throw new Error(
                `Deposit amount exceeds maximum allowed. Maximum deposit: ${maxDepositFormatted}. Your requested amount: ${Number(assets) / 1e6} USDC.`
              );
            }
          } catch (maxDepositError: any) {
            // If maxDeposit check fails, log it but continue (might be a read error)
            console.warn("Could not check maxDeposit:", maxDepositError);
            // Don't throw here - let the gas estimation catch the actual error
          }
        }

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
          
          // Estimate gas before sending (helps catch errors early)
          let gasEstimate: bigint | undefined;
          try {
            if (publicClient) {
              gasEstimate = await publicClient.estimateGas({
                account,
                to: vaultAddress,
                data,
              });
            }
          } catch (gasError: any) {
            // If gas estimation fails, the transaction will likely fail
            console.error("Gas estimation error:", gasError);
            
            // Try to extract the actual revert reason from viem error
            let errorMessage = gasError?.message || "Transaction would fail";
            let revertReason = "";
            
            // Check for revert reason in error data
            if (gasError?.data) {
              if (typeof gasError.data === "string") {
                revertReason = gasError.data;
              } else if (gasError.data?.message) {
                revertReason = gasError.data.message;
              } else if (gasError.data?.reason) {
                revertReason = gasError.data.reason;
              }
            }
            
            // Check for revert reason in cause
            if (!revertReason && gasError?.cause) {
              if (typeof gasError.cause === "string") {
                revertReason = gasError.cause;
              } else if (gasError.cause?.message) {
                revertReason = gasError.cause.message;
              } else if (gasError.cause?.data?.message) {
                revertReason = gasError.cause.data.message;
              }
            }
            
            // Try to parse common revert reasons
            if (revertReason || errorMessage.includes("revert") || errorMessage.includes("execution reverted")) {
              // Check for specific revert reasons
              const lowerReason = (revertReason + " " + errorMessage).toLowerCase();
              
              if (lowerReason.includes("paused") || lowerReason.includes("pause")) {
                throw new Error("Deposit failed: The vault is currently paused. Deposits are not available at this time.");
              }
              
              if (lowerReason.includes("capacity") || lowerReason.includes("limit") || lowerReason.includes("max")) {
                throw new Error("Deposit failed: The vault has reached its deposit capacity. Please try a smaller amount or try again later.");
              }
              
              if (lowerReason.includes("allowance") || lowerReason.includes("approval")) {
                throw new Error("Deposit failed: Insufficient token allowance. Please approve the vault to spend your tokens.");
              }
              
              // Generic revert error with more context
              const detailedError = revertReason 
                ? `Deposit failed: ${revertReason}`
                : "Deposit failed: The transaction was reverted. The vault may be paused, have insufficient capacity, or there may be another issue. Please check the vault status and try again.";
              
              throw new Error(detailedError);
            }
            
            throw new Error(`Transaction validation failed: ${errorMessage}`);
          }
          
          // Send transaction using wallet client
          try {
            depositHash = await activeWalletClient.sendTransaction({
              account,
              to: vaultAddress,
              data,
              chain: activeWalletClient.chain || null,
              gas: gasEstimate ? (gasEstimate * 120n / 100n) : undefined, // Add 20% buffer
            });
          } catch (txError: any) {
            // Parse transaction error
            const errorMessage = txError?.message || "Transaction failed";
            if (errorMessage.includes("user rejected") || errorMessage.includes("User denied")) {
              throw new Error("Transaction was cancelled");
            }
            if (errorMessage.includes("revert") || errorMessage.includes("execution reverted")) {
              throw new Error("Deposit failed: The transaction was reverted. The vault may be paused, have insufficient capacity, or there may be another issue. Please check the vault status and try again.");
            }
            throw new Error(`Deposit failed: ${errorMessage}`);
          }
        } else {
          try {
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
          } catch (txError: any) {
            const errorMessage = txError?.message || "Transaction failed";
            if (errorMessage.includes("user rejected") || errorMessage.includes("User denied")) {
              throw new Error("Transaction was cancelled");
            }
            if (errorMessage.includes("revert") || errorMessage.includes("execution reverted")) {
              throw new Error("Deposit failed: The transaction was reverted. The vault may be paused, have insufficient capacity, or there may be another issue. Please check the vault status and try again.");
            }
            throw new Error(`Deposit failed: ${errorMessage}`);
          }
        }

        // Wait for deposit to be mined
        if (publicClient) {
          try {
            const receipt = await publicClient.waitForTransactionReceipt({
              hash: depositHash,
              timeout: 120_000, // 2 minute timeout
            });
            
            // Check if transaction was reverted
            if (receipt.status === "reverted") {
              throw new Error("Transaction was reverted on-chain. Please check the transaction on Basescan for more details.");
            }
          } catch (waitError: any) {
            // If waiting fails, the transaction might still be pending or reverted
            const errorMessage = waitError?.message || "Failed to confirm transaction";
            if (errorMessage.includes("timeout")) {
              throw new Error("Transaction is taking longer than expected. Please check the transaction status on Basescan.");
            }
            throw new Error(`Failed to confirm transaction: ${errorMessage}`);
          }
        }

        setState({
          status: "success",
          txHash: depositHash,
        });
      } catch (error) {
        // Log the full error for debugging
        console.error("Deposit error:", error);
        
        let errorMessage = "Deposit failed";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (error && typeof error === "object" && "message" in error) {
          errorMessage = String(error.message);
        }
        
        setState({
          status: "error",
          error: errorMessage,
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

