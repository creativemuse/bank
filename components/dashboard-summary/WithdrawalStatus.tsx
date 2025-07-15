import { useEffect, useState } from "react";
import { useAuth } from "@crossmint/client-sdk-react-ui";
import { getTransactions } from "@/server-actions/getTransactions";

export function WithdrawalStatus() {
  const { user } = useAuth();
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const checkPendingTransactions = async () => {
      setIsChecking(true);
      try {
        const transactions = await getTransactions(user.id);
        const pending = transactions.find((tx: any) => tx.status === "TRANSACTION_STATUS_STARTED");
        setPendingTransaction(pending);
      } catch (error: any) {
        if (
          process.env.NODE_ENV !== "production" &&
          error.message === "Withdrawals are only enabled in production."
        ) {
          // Optionally, do nothing or show a dev-friendly message
          setPendingTransaction(null);
        } else {
          console.error("Error checking pending transactions:", error);
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkPendingTransactions();

    // Check every 10 seconds for updates
    const interval = setInterval(checkPendingTransactions, 10000);

    return () => clearInterval(interval);
  }, [user?.id]);

  if (!pendingTransaction && !isChecking) {
    return null;
  }

  return (
    <div className="mx-auto mb-4 w-full max-w-5xl">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-center space-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
          <div>
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Withdrawal in Progress
            </h3>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              {pendingTransaction ? (
                <>
                  Processing withdrawal of ${pendingTransaction.sell_amount?.value || "N/A"} USDC.
                  Please complete the transaction in your wallet when prompted.
                </>
              ) : (
                "Checking for pending withdrawals..."
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
