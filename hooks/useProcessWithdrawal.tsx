import { useEffect } from "react";
import { Chain, Wallet } from "@crossmint/client-sdk-react-ui";
import { getTransactions } from "@/server-actions/getTransactions";
import { useBalance } from "./useBalance";
import { useActivityFeed } from "./useActivityFeed";

const getProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    return JSON.parse(processedTransactions)[transactionId] || false;
  }
  return false;
};

const setProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    const parsed = JSON.parse(processedTransactions);
    parsed[transactionId] = true;
    localStorage.setItem("processedTransactions", JSON.stringify(parsed));
  } else {
    localStorage.setItem("processedTransactions", JSON.stringify({ [transactionId]: true }));
  }
};

export function useProcessWithdrawal(userId?: string, wallet?: Wallet<Chain>) {
  const { refetch: refetchBalance } = useBalance();
  const { refetch: refetchActivityFeed } = useActivityFeed();

  useEffect(() => {
    if (!userId || !wallet) {
      return;
    }

    const processWithdrawal = async () => {
      try {
        console.log("Checking for pending withdrawal transactions...");
        const transactions = await getTransactions(userId);

        // Add proper null/undefined checks
        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
          console.log("No transactions found for user:", userId);
          return;
        }

        // Look for the most recent transaction that needs processing
        const pendingTransaction = transactions.find(
          (transaction) =>
            transaction?.status === "TRANSACTION_STATUS_STARTED" &&
            transaction?.transaction_id &&
            !getProccesedTransactions(transaction.transaction_id)
        );

        if (pendingTransaction) {
          console.log("Processing withdrawal transaction:", pendingTransaction.transaction_id);

          // Mark as processed to prevent duplicate processing
          setProccesedTransactions(pendingTransaction.transaction_id);

          try {
            // Send the transaction using the wallet
            await wallet.send(
              pendingTransaction.to_address,
              "usdc",
              pendingTransaction.sell_amount.value
            );

            console.log("Withdrawal transaction sent successfully");

            // Refresh data after successful transaction
            await Promise.all([refetchBalance(), refetchActivityFeed()]);
          } catch (sendError) {
            console.error("Failed to send withdrawal transaction:", sendError);
            // Could implement retry logic here if needed
            throw sendError;
          }
        } else {
          console.log("No pending withdrawal transactions found");
        }
      } catch (error) {
        console.error("Error processing withdrawal:", error);

        // Show user-friendly error message
        if (error instanceof Error) {
          if (error.message.includes("credentials")) {
            console.error("Coinbase API credentials issue - withdrawal may not work");
          } else if (error.message.includes("network") || error.message.includes("fetch")) {
            console.error("Network error while processing withdrawal");
          } else if (error.message.includes("production")) {
            console.error("Withdrawal processing is only available in production");
          } else {
            console.error("Unexpected error during withdrawal processing:", error.message);
          }
        } else {
          console.error("Unknown error during withdrawal processing:", error);
        }
      }
    };

    // Run the withdrawal processing
    processWithdrawal();
  }, [userId, wallet, refetchBalance, refetchActivityFeed]);
}
