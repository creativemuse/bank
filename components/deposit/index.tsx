import React, { useCallback, useEffect, useState } from "react";
import {
  CrossmintCheckoutProvider,
  CrossmintProvider,
  useAuth,
} from "@crossmint/client-sdk-react-ui";
import { CoinbaseOnrampCheckout } from "./CoinbaseOnrampCheckout";
import { AmountInput } from "../common/AmountInput";
import { Modal } from "../common/Modal";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { cn } from "@/lib/utils";
import { useBalance } from "@/hooks/useBalance";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
}

const CLIENT_API_KEY_CONSOLE_FUND = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY;

const MAX_AMOUNT = 100000; // Max amount in USD allowed in staging

export function DepositModal({ open, onClose, walletAddress }: DepositModalProps) {
  const [step, setStep] = useState<"options" | "processing" | "completed">("options");
  const { user } = useAuth();
  const receiptEmail = user?.email;
  const [amount, setAmount] = useState("");
  const { refetch: refetchActivityFeed } = useActivityFeed();
  const { refetch: refetchBalance } = useBalance();

  const restartFlow = () => {
    setStep("options");
    setAmount("");
  };

  // Reset to options whenever the modal is opened so reopening always shows a fresh flow
  useEffect(() => {
    if (open) {
      setStep("options");
      setAmount("");
    }
  }, [open]);

  const handleDone = () => {
    restartFlow();
    onClose();
  };

  const handlePaymentCompleted = useCallback(() => {
    refetchActivityFeed();
    refetchBalance();
    handleDone();
  }, [refetchActivityFeed, refetchBalance, handleDone]);

  const handleProcessingPayment = useCallback(() => {
    setStep("processing");
  }, []);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        showBackButton={step !== "processing"}
        onBack={step === "options" ? handleDone : restartFlow}
        showCloseButton={true}
        className={cn(
          "top-[70px] h-[calc(100dvh-174px)] md:max-h-[calc(100dvh-174px)] lg:top-0 lg:max-h-[calc(100dvh-32px)]",
          amount && " lg:min-h-[718px]"
        )}
        title="Deposit"
      >
        {open && step === "options"}
        {step === "options" && (
          <div className="mb-6 flex w-full flex-col items-center">
            <AmountInput amount={amount} onChange={setAmount} />
            {Number(amount) > MAX_AMOUNT && (
              <div className="mt-1 text-center text-red-600">
                Transaction amount exceeds the maximum allowed deposit limit of ${MAX_AMOUNT}
              </div>
            )}
          </div>
        )}
        <div className="flex w-full flex-grow flex-col">
          <CoinbaseOnrampCheckout
            amount={amount}
            isAmountValid={Number(amount) <= MAX_AMOUNT && Number(amount) >= 1}
            walletAddress={walletAddress}
            onPaymentCompleted={handlePaymentCompleted}
            receiptEmail={receiptEmail || ""}
            onProcessingPayment={handleProcessingPayment}
            step={step}
            goBack={restartFlow}
            MAX_AMOUNT={MAX_AMOUNT}
          />
        </div>
      </Modal>
    </>
  );
}
