import Image from "next/image";
import { WalletBalance } from "./WalletBalance";
import { DepositButton } from "../common/DepositButton";
import { Container } from "../common/Container";
import {
  ArrowsRightLeftIcon,
  WalletIcon,
  ArrowUpRightIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { Dropdown } from "../common/Dropdown";
import { useState } from "react";
import { WalletDetails } from "./WalletDetails";
import { useWallet, useAuth } from "@crossmint/client-sdk-react-ui";
import { WarningModal } from "./WarningModal";
import createCoinbaseSessionToken from "@/server-actions/createCoinbaseSessionToken";

interface DashboardSummaryProps {
  onDepositClick: () => void;
  onSendClick: () => void;
}

export function DashboardSummary({ onDepositClick, onSendClick }: DashboardSummaryProps) {
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const { wallet } = useWallet();
  const { user } = useAuth();
  const [openWarningModal, setOpenWarningModal] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const dropdownOptions = [
    {
      icon: <ArrowsRightLeftIcon className="h-4 w-4 text-gray-900 dark:text-gray-100" />,
      label: "Withdraw",
      onClick: async () => {
        if (process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY?.includes("staging")) {
          setOpenWarningModal(true);
        } else {
          if (!wallet?.address || !wallet?.chain || !user?.id) {
            console.error("Missing wallet or user information for withdrawal");
            alert("Missing wallet or user information. Please try again.");
            return;
          }

          setIsWithdrawing(true);
          try {
            const token = await createCoinbaseSessionToken({
              address: wallet.address,
              blockchains: [wallet.chain],
              assets: ["USDC", "ETH"],
            });

            if (!token) {
              throw new Error("No session token received from backend");
            }

            const params = new URLSearchParams({
              sessionToken: token,
              partnerUserId: user.id,
              redirectUrl: window.location.origin,
            });

            const offrampUrl = `https://pay.coinbase.com/v3/sell/input?${params}`;
            window.location.href = offrampUrl;
          } catch (error) {
            console.error(
              "Withdrawal failed:",
              error instanceof Error ? error.message : "Unknown error"
            );
            alert("Failed to start withdrawal. Please try again.");
          } finally {
            setIsWithdrawing(false);
          }
        }
      },
    },
    {
      icon: <WalletIcon className="h-4 w-4 text-gray-900 dark:text-gray-100" />,
      label: "Wallet Details",
      onClick: () => {
        setShowWalletDetails(true);
      },
    },
  ];

  const dropdownTrigger = (
    <button className="rounded-full bg-secondary p-2.5 hover:bg-secondary/80">
      <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
    </button>
  );

  return (
    <Container className="flex w-full max-w-5xl flex-col items-center justify-between md:flex-row md:items-stretch">
      <WalletBalance />
      <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
        <DepositButton onClick={onDepositClick} />
        <button
          type="button"
          className="flex h-12 flex-grow items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80 md:w-40"
          onClick={onSendClick}
        >
          <ArrowUpRightIcon className="h-4 w-4 text-gray-500" /> Send
        </button>
        <Dropdown trigger={dropdownTrigger} options={dropdownOptions} />
        {isWithdrawing && <div className="ml-2 text-sm text-gray-500">Preparing withdrawal...</div>}
      </div>
      <WalletDetails onClose={() => setShowWalletDetails(false)} open={showWalletDetails} />
      <WarningModal open={openWarningModal} onClose={() => setOpenWarningModal(false)} />
    </Container>
  );
}
