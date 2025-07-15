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

  useEffect(() => {
    if (!user?.id) return;

    const checkPendingTransactions = async () => {
      setIsChecking(true);
      try {
        const transactions = await getTransactions(user.id);
        const pending = transactions.find((tx: any) => tx.status === "TRANSACTION_STATUS_STARTED");
        setPendingTransaction(pending);
      } catch (error) {
        console.error("Error checking pending transactions:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkPendingTransactions();
  }, [user?.id]);

  if (isChecking) {
    return <div>Checking withdrawal status...</div>;
  }
  if (pendingTransaction) {
    return <div>Pending withdrawal: {pendingTransaction.id}</div>;
  }
  return null;
}
