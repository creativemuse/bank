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
    (async () => {
      if (userId && wallet) {
        try {
          const transactions = await getTransactions(userId);

          // Add proper null/undefined checks
          if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            console.log("No transactions found for user:", userId);
            return;
          }

          const transaction = transactions[0];
          if (
            transaction?.status === "TRANSACTION_STATUS_STARTED" &&
            transaction?.transaction_id &&
            !getProccesedTransactions(transaction.transaction_id)
          ) {
            setProccesedTransactions(transaction.transaction_id);
            await wallet.send(transaction.to_address, "usdc", transaction.sell_amount.value);
            refetchBalance();
            refetchActivityFeed();
          }
        } catch (error) {
          console.error("Error processing withdrawal:", error);
        }
      }
    })();
  }, [userId, wallet]); // Removed refetch functions from dependency array
}
