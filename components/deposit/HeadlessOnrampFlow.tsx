"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useStytch } from "@stytch/nextjs";
import { useAuth } from "@/context/AuthContext";
import { useOnrampOrder } from "@/hooks/useOnrampOrder";
import { OTPVerification } from "@/components/auth/OTPVerification";
import { TermsAcceptance } from "./TermsAcceptance";
import { OnrampQuoteDisplay } from "./OnrampQuoteDisplay";
import { PaymentIframe } from "./PaymentIframe";
import { PrimaryButton } from "@/components/common/PrimaryButton";

type HeadlessStep =
  | "idle"
  | "phone-input"
  | "phone-otp"
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
  const stytch = useStytch();
  const { user } = useAuth();
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
  const [phoneMethodId, setPhoneMethodId] = useState("");
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(
    user?.phoneNumberVerifiedAt || null,
  );
  const [agreementAcceptedAt, setAgreementAcceptedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);

  const email = receiptEmail || user?.email || "";

  // Auto-detect payment method based on browser/device
  const paymentMethod =
    typeof window !== "undefined" && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
      ? "GUEST_CHECKOUT_APPLE_PAY"
      : "GUEST_CHECKOUT_GOOGLE_PAY";

  // Check if phone is already verified (Warm Start)
  const hasWarmStartPhone = !!(user?.phoneNumber && user?.phoneNumberVerifiedAt);

  // Handle the Warm Start — skip phone OTP for returning users
  const handleStartFlow = useCallback(async () => {
    if (hasWarmStartPhone && user?.phoneNumber) {
      // Phone already verified within 60 days — skip directly to terms
      setPhoneNumber(user.phoneNumber);
      setPhoneVerifiedAt(user.phoneNumberVerifiedAt!);
      setHeadlessStep("terms");
    } else {
      setHeadlessStep("phone-input");
    }
  }, [hasWarmStartPhone, user]);

  // Send phone OTP
  const handleSendPhoneOTP = async () => {
    if (!phoneNumber.trim()) return;
    setError(null);
    setIsOtpLoading(true);

    try {
      const response = await fetch("/api/auth/stytch/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sms", destination: phoneNumber.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send OTP");

      setPhoneMethodId(data.methodId);
      setHeadlessStep("phone-otp");
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setIsOtpLoading(false);
    }
  };

  // Verify phone OTP
  const handleVerifyPhoneOTP = async (code: string) => {
    try {
      const response = await fetch("/api/auth/stytch/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methodId: phoneMethodId,
          code,
          type: "sms",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Invalid code");

      setPhoneVerifiedAt(new Date().toISOString());
      setHeadlessStep("terms");
    } catch (err: any) {
      throw err;
    }
  };

  // Resend phone OTP
  const handleResendPhoneOTP = async () => {
    const response = await fetch("/api/auth/stytch/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sms", destination: phoneNumber.trim() }),
    });
    const data = await response.json();
    if (response.ok) setPhoneMethodId(data.methodId);
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
  }, [headlessStep, amount, walletAddress, phoneNumber, email, agreementAcceptedAt, phoneVerifiedAt, fetchQuote]);

  // Create order after reviewing quote
  const handleConfirmQuote = async () => {
    if (!agreementAcceptedAt || !phoneVerifiedAt) return;

    const tokens = stytch.session.getTokens();

    await createOrder({
      paymentAmount: amount,
      destinationAddress: walletAddress,
      phoneNumber,
      email,
      agreementAcceptedAt,
      phoneNumberVerifiedAt: phoneVerifiedAt,
      sessionToken: tokens?.session_token,
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
    setPhoneMethodId("");
    setPhoneVerifiedAt(user?.phoneNumberVerifiedAt || null);
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
        {(error || orderError) && (
          <div className="text-sm text-red-600">{error || orderError}</div>
        )}
        <PrimaryButton onClick={handleStartFlow} disabled={!isAmountValid}>
          {hasWarmStartPhone ? "Continue to Deposit" : "Deposit Funds"}
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
            onKeyDown={(e) => e.key === "Enter" && handleSendPhoneOTP()}
            placeholder="+1 (555) 555-5555"
            autoFocus
            className="w-full rounded-md border border-gray-600 bg-gray-300 px-4 py-3 text-sm text-black placeholder:text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-center text-xs text-gray-900">
            Enter your phone number in E.164 format (e.g., +12025551234)
          </p>
          <PrimaryButton
            onClick={handleSendPhoneOTP}
            disabled={!phoneNumber.trim() || isOtpLoading}
          >
            {isOtpLoading ? "Sending..." : "Send Verification Code"}
          </PrimaryButton>
        </div>
      )}

      {/* Phone OTP verification */}
      {headlessStep === "phone-otp" && (
        <OTPVerification
          type="phone"
          destination={phoneNumber}
          onVerify={handleVerifyPhoneOTP}
          onResend={handleResendPhoneOTP}
          error={error}
        />
      )}

      {/* Terms acceptance */}
      {headlessStep === "terms" && (
        <TermsAcceptance
          onAccept={handleTermsAccepted}
          isLoading={isLoadingQuote}
        />
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
          <div className="text-sm font-medium text-black">
            Payment completed successfully!
          </div>
          <p className="text-center text-xs text-gray-900">
            Your USDC will arrive in your wallet shortly.
          </p>
        </div>
      )}

      {/* Failed */}
      {headlessStep === "failed" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm font-medium text-red-600">
            Payment failed or was cancelled.
          </div>
          <PrimaryButton onClick={handleReset}>Try Again</PrimaryButton>
        </div>
      )}
    </div>
  );
}
