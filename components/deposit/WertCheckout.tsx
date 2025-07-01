"use client";

import { useRef } from "react";
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
  // Ref to keep WertWidget instance
  const wertWidgetRef = useRef<any>(null);

  // Prepare options for WertWidget
  const staticOptions = {
    partner_id: "01HSD48HCYJH2SNT65S5A0JYPP",
    origin: "https://widget.wert.io",
    address: walletAddress,
    commodities: JSON.stringify([
      { commodity: "USDC", network: "base" },
      { commodity: "ETH", network: "base" },
    ]),
    commodity_amount: amount ? Number.parseFloat(amount) : undefined,
    ...(receiptEmail ? { email: receiptEmail } : {}),
    click_id: uuidv4(),
    theme: "dark" as const,
    listeners: {
      loaded: () => {
        // Widget loaded
      },
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

  // Handler to open WertWidget
  const handleOpenWidget = () => {
    // Only create a new instance if one doesn't exist or is closed
    if (!wertWidgetRef.current) {
      wertWidgetRef.current = new WertWidget(staticOptions);
    }
    wertWidgetRef.current.open();
  };

  if (!amount || !isAmountValid) return null;

  return (
    <div className="flex w-full flex-col items-center justify-center space-y-4">
      <PrimaryButton onClick={handleOpenWidget}>Deposit</PrimaryButton>
    </div>
  );
}
