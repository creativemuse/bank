"use client";

import { useState, useEffect, useRef } from "react";
import { PrimaryButton } from "../common/PrimaryButton";
import createCoinbaseSessionToken from "@/server-actions/createCoinbaseSessionToken";

export type CoinbaseOnrampCheckoutProps = {
  amount: string;
  walletAddress: string;
  onPaymentCompleted: () => void;
  onProcessingPayment: () => void;
  isAmountValid: boolean;
  step: "options" | "processing" | "completed";
  goBack: () => void;
  receiptEmail?: string;
  MAX_AMOUNT: number;
};

export function CoinbaseOnrampCheckout({
  amount,
  walletAddress,
  onPaymentCompleted,
  onProcessingPayment,
  isAmountValid,
  step,
  goBack,
  receiptEmail,
  MAX_AMOUNT,
}: CoinbaseOnrampCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  const handleOpenOnramp = async () => {
    setError(null);
    setLoading(true);

    // Clean up any existing intervals and listeners before starting a new session
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (messageHandlerRef.current) {
      window.removeEventListener("message", messageHandlerRef.current);
      messageHandlerRef.current = null;
    }

    try {
      // Generate session token
      const token = await createCoinbaseSessionToken({
        address: walletAddress,
        blockchains: ["base"],
        assets: ["USDC"],
      });

      if (!token) {
        throw new Error("Failed to generate session token");
      }

      // Build onramp URL with one-click-buy parameters
      const params = new URLSearchParams({
        sessionToken: token,
        defaultNetwork: "base",
        defaultAsset: "USDC",
        presetFiatAmount: amount,
        fiatCurrency: "USD",
      });

      const onrampUrl = `https://pay.coinbase.com/buy/select-asset?${params.toString()}`;

      // Open popup window
      const width = 500;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      popupRef.current = window.open(
        onrampUrl,
        "Coinbase Onramp",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popupRef.current) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      // Monitor popup for close events
      const checkPopupClosed = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(checkPopupClosed);
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          // When popup closes, assume payment is processing
          onProcessingPayment();
        }
      }, 1000);

      // Store interval for cleanup
      checkIntervalRef.current = checkPopupClosed;

      // Listen for messages from popup (if Coinbase sends postMessage events)
      const handleMessage = (event: MessageEvent) => {
        // Only accept messages from Coinbase domain
        if (event.origin !== "https://pay.coinbase.com") {
          return;
        }

        // Handle payment completion events
        if (event.data?.type === "payment-success" || event.data?.status === "success") {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }
          if (messageHandlerRef.current) {
            window.removeEventListener("message", messageHandlerRef.current);
            messageHandlerRef.current = null;
          }
          onPaymentCompleted();
        }
      };

      messageHandlerRef.current = handleMessage;
      window.addEventListener("message", handleMessage);

      setLoading(false);
    } catch (err: any) {
      // Clean up intervals and listeners on error
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      setError(err.message || "Failed to start Coinbase onramp. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center justify-center space-y-4">
      {error && <div className="text-red-500">{error}</div>}
      <PrimaryButton onClick={handleOpenOnramp} disabled={loading || !isAmountValid}>
        {loading ? "Loading..." : "Deposit Funds"}
      </PrimaryButton>
      {!isAmountValid && (
        <div className="text-xs text-red-500">
          Please enter a valid amount between $1 and ${MAX_AMOUNT}
        </div>
      )}
    </div>
  );
}

