"use client";

import { useRef, useState } from "react";
import WertWidget from "@wert-io/widget-initializer";
import { v4 as uuidv4 } from "uuid";
import { PrimaryButton } from "../common/PrimaryButton";

export type WertCheckoutProps = {
  amount: string;
  walletAddress: string;
  onPaymentCompleted: () => void;
  onProcessingPayment: () => void;
  isAmountValid: boolean;
  step: "options" | "processing" | "completed";
  goBack: () => void;
  receiptEmail?: string;
};

export function WertCheckout({
  amount,
  walletAddress,
  onPaymentCompleted,
  onProcessingPayment,
  isAmountValid,
  step,
  goBack,
  receiptEmail,
}: WertCheckoutProps) {
  const wertWidgetRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenWidget = async () => {
    setError(null);
    setLoading(true);
    try {
      // Dynamically import the server action
      const createWertSession = (await import("../../server-actions/createWertSession")).default;
      const sessionId = await createWertSession({
        walletAddress,
        amount,
        email: receiptEmail,
      });
      const options = {
        partner_id: "01HSD48HCYJH2SNT65S5A0JYPP",
        session_id: sessionId,
        origin: "https://widget.wert.io",
        click_id: uuidv4(),
        theme: "dark" as const,
        listeners: {
          loaded: () => {},
          close: () => {
            onProcessingPayment();
          },
          "payment-status": (data: any) => {
            if (data?.status === "success") {
              onPaymentCompleted();
            }
          },
        },
      };
      if (!wertWidgetRef.current) {
        wertWidgetRef.current = new WertWidget(options);
      }
      wertWidgetRef.current.open();
    } catch (err: any) {
      setError("Failed to start Wert session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!amount || !isAmountValid) return null;

  return (
    <div className="flex w-full flex-col items-center justify-center space-y-4">
      {error && <div className="text-red-500">{error}</div>}
      <PrimaryButton onClick={handleOpenWidget} disabled={loading}>
        {loading ? "Loading..." : "Deposit"}
      </PrimaryButton>
    </div>
  );
}
