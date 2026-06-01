"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOnrampOrder } from "@/hooks/useOnrampOrder";
import { TermsAcceptance } from "./TermsAcceptance";
import { OnrampQuoteDisplay } from "./OnrampQuoteDisplay";
import { PaymentIframe } from "./PaymentIframe";
import { PrimaryButton } from "@/components/common/PrimaryButton";

type HeadlessStep =
  | "idle"
  | "phone-input"
  | "terms"
  | "quote"
  | "payment"
  | "polling"
  | "completed"
  | "failed";

interface HeadlessOnrampFlowProps {
  amount: string;
  walletAddress: string;
  onPaymentCompleted: () => void;
  onProcessingPayment: () => void;
  isAmountValid: boolean;
  step: "options" | "processing" | "completed";
  goBack: () => void;
  receiptEmail?: string;
  MAX_AMOUNT: number;
}

export function HeadlessOnrampFlow({
  amount,
  walletAddress,
  onPaymentCompleted,
  onProcessingPayment,
  isAmountValid,
  step: parentStep,
  goBack,
  receiptEmail,
  MAX_AMOUNT,
}: HeadlessOnrampFlowProps) {
  const { user, jwt } = useAuth();
  const {
    quote,
    order,
    isLoadingQuote,
    isCreatingOrder,
    isPolling,
    error: orderError,
    fetchQuote,
    createOrder,
    reset: resetOrder,
  } = useOnrampOrder();

  const [headlessStep, setHeadlessStep] = useState<HeadlessStep>("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(null);
  const [agreementAcceptedAt, setAgreementAcceptedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const email = receiptEmail || user?.email || "";

  // Auto-detect payment method based on browser/device
  const paymentMethod =
    typeof window !== "undefined" &&
    /Safari/.test(navigator.userAgent) &&
    !/Chrome/.test(navigator.userAgent)
      ? "GUEST_CHECKOUT_APPLE_PAY"
      : "GUEST_CHECKOUT_GOOGLE_PAY";

  const hasProfilePhone = !!user?.phoneNumber;

  const handleStartFlow = useCallback(() => {
    if (hasProfilePhone && user?.phoneNumber) {
      setPhoneNumber(user.phoneNumber);
      setPhoneVerifiedAt(new Date().toISOString());
      setHeadlessStep("terms");
    } else {
      setHeadlessStep("phone-input");
    }
  }, [hasProfilePhone, user]);

  const handleContinueFromPhone = () => {
    if (!phoneNumber.trim()) return;
    setError(null);
    setPhoneVerifiedAt(new Date().toISOString());
    setHeadlessStep("terms");
  };

  // Accept terms
  const handleTermsAccepted = async (timestamp: string) => {
    setAgreementAcceptedAt(timestamp);
    await fetchQuote({
      paymentAmount: amount,
      destinationAddress: walletAddress,
      phoneNumber,
      email,
      agreementAcceptedAt: timestamp,
      phoneNumberVerifiedAt: phoneVerifiedAt || undefined,
      paymentMethod,
    });
    setHeadlessStep("quote");
  };

  // Auto-refresh quote every 15 seconds while on the quote step
  const quoteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (headlessStep === "quote" && agreementAcceptedAt && phoneVerifiedAt) {
      quoteIntervalRef.current = setInterval(() => {
        fetchQuote({
          paymentAmount: amount,
          destinationAddress: walletAddress,
          phoneNumber,
          email,
          agreementAcceptedAt,
          phoneNumberVerifiedAt: phoneVerifiedAt || undefined,
          paymentMethod,
        });
      }, 15000);

      return () => {
        if (quoteIntervalRef.current) {
          clearInterval(quoteIntervalRef.current);
          quoteIntervalRef.current = null;
        }
      };
    }
  }, [
    headlessStep,
    amount,
    walletAddress,
    phoneNumber,
    email,
    agreementAcceptedAt,
    phoneVerifiedAt,
    fetchQuote,
  ]);

  // Create order after reviewing quote
  const handleConfirmQuote = async () => {
    if (!agreementAcceptedAt || !phoneVerifiedAt) return;

    if (!jwt) {
      setError("Please sign in to continue.");
      return;
    }

    await createOrder({
      paymentAmount: amount,
      destinationAddress: walletAddress,
      phoneNumber,
      email,
      agreementAcceptedAt,
      phoneNumberVerifiedAt: phoneVerifiedAt,
      sessionToken: jwt,
      paymentMethod,
    });

    setHeadlessStep("payment");
    onProcessingPayment();
  };

  // Payment completed via iframe postMessage
  const handlePaymentComplete = () => {
    setHeadlessStep("completed");
    onPaymentCompleted();
  };

  // Payment failed
  const handlePaymentFailed = () => {
    setHeadlessStep("failed");
  };

  // Reset entire flow
  const handleReset = () => {
    setHeadlessStep("idle");
    setPhoneNumber("");
    setPhoneVerifiedAt(null);
    setAgreementAcceptedAt(null);
    setError(null);
    resetOrder();
  };

  // Parent controls processing/completed states
  if (parentStep === "processing" && headlessStep !== "payment") {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-900" />
          <span className="text-sm text-gray-900">Processing payment...</span>
        </div>
      </div>
    );
  }

  if (parentStep === "completed") {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        <div className="text-sm text-black">Payment completed successfully!</div>
      </div>
    );
  }

  // Show start button when parent is in "options" and we haven't started the flow
  if (parentStep === "options" && headlessStep === "idle") {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        {(error || orderError) && <div className="text-sm text-red-600">{error || orderError}</div>}
        <PrimaryButton onClick={handleStartFlow} disabled={!isAmountValid}>
          {hasProfilePhone ? "Continue to Deposit" : "Deposit Funds"}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {(error || orderError) && (
        <div className="text-center text-sm text-red-500">{error || orderError}</div>
      )}

      {/* Phone number input */}
      {headlessStep === "phone-input" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-sm text-gray-900">
            Coinbase requires a verified phone number for identity verification.
          </p>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleContinueFromPhone()}
            placeholder="+1 (555) 555-5555"
            autoFocus
            className="w-full rounded-md border border-gray-600 bg-gray-300 px-4 py-3 text-sm text-black placeholder:text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-center text-xs text-gray-900">
            Enter your phone number in E.164 format (e.g., +12025551234)
          </p>
          <PrimaryButton onClick={handleContinueFromPhone} disabled={!phoneNumber.trim()}>
            Continue
          </PrimaryButton>
        </div>
      )}

      {/* Terms acceptance */}
      {headlessStep === "terms" && (
        <TermsAcceptance onAccept={handleTermsAccepted} isLoading={isLoadingQuote} />
      )}

      {/* Quote display */}
      {headlessStep === "quote" && quote && (
        <OnrampQuoteDisplay
          paymentAmount={amount}
          purchaseAmount={quote.purchaseAmount}
          exchangeRate={quote.exchangeRate}
          fees={quote.fees}
          paymentCurrency="USD"
          purchaseCurrency="USDC"
          onConfirm={handleConfirmQuote}
          onRefresh={() =>
            fetchQuote({
              paymentAmount: amount,
              destinationAddress: walletAddress,
              phoneNumber,
              email,
              agreementAcceptedAt: agreementAcceptedAt!,
              phoneNumberVerifiedAt: phoneVerifiedAt || undefined,
              paymentMethod,
            })
          }
          isLoading={isCreatingOrder || isLoadingQuote}
        />
      )}

      {/* Payment iframe */}
      {headlessStep === "payment" && order?.paymentLink?.url && (
        <PaymentIframe
          paymentUrl={order.paymentLink.url}
          onPaymentComplete={handlePaymentComplete}
          onPaymentFailed={handlePaymentFailed}
        />
      )}

      {/* Polling status */}
      {headlessStep === "payment" && isPolling && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-900">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-gray-900" />
          Waiting for payment confirmation...
        </div>
      )}

      {/* Completed */}
      {headlessStep === "completed" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm font-medium text-black">Payment completed successfully!</div>
          <p className="text-center text-xs text-gray-900">
            Your USDC will arrive in your wallet shortly.
          </p>
        </div>
      )}

      {/* Failed */}
      {headlessStep === "failed" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm font-medium text-red-600">Payment failed or was cancelled.</div>
          <PrimaryButton onClick={handleReset}>Try Again</PrimaryButton>
        </div>
      )}
    </div>
  );
}
