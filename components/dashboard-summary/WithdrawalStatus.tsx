import { useEffect, useState } from "react";
import { useAuth } from "@crossmint/client-sdk-react-ui";
import { getTransactions } from "@/server-actions/getTransactions";

export function WithdrawalStatus() {
  // Only render in production
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const { user } = useAuth();
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const checkPendingTransactions = async () => {
      setIsChecking(true);
      setError(null);
      try {
        const transactions = await getTransactions(user.id);
        const pending = transactions.find((tx: any) => tx.status === "TRANSACTION_STATUS_STARTED");
        setPendingTransaction(pending);
      } catch (error) {
        console.error("Error checking pending transactions:", error);
        setError(error instanceof Error ? error.message : "Failed to check withdrawal status");
      } finally {
        setIsChecking(false);
      }
    };

    checkPendingTransactions();
  }, [user?.id]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-gray-500">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        Checking withdrawal status...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-red-500">
        Error: {error}
      </div>
    );
  }

  if (pendingTransaction) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-blue-600">
        Pending withdrawal: {pendingTransaction.id}
      </div>
    );
  }

  return null;
}
