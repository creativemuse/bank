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
import { checkCoinbaseConfig } from "@/server-actions/checkCoinbaseConfig";

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
  const [withdrawalStatus, setWithdrawalStatus] = useState<string | null>(null);
  const dropdownOptions = [
    {
      icon: <ArrowsRightLeftIcon className="h-4 w-4 text-gray-900 dark:text-gray-100" />,
      label: "Withdraw",
      onClick: async () => {
        setWithdrawalStatus("Checking configuration...");

        // Check if Coinbase API keys are configured
        try {
          const config = await checkCoinbaseConfig();
          if (!config.isConfigured) {
            setOpenWarningModal(true);
            setWithdrawalStatus(null);
            return;
          }

          if (!config.isProduction) {
            setWithdrawalStatus("Withdrawals are only available in production");
            setTimeout(() => setWithdrawalStatus(null), 3000);
            return;
          }
        } catch (error) {
          console.error("Failed to check Coinbase configuration:", error);
          setWithdrawalStatus("Failed to check configuration");
          setTimeout(() => setWithdrawalStatus(null), 3000);
          return;
        }

        if (!wallet?.address || !wallet?.chain || !user?.id) {
          console.error("Missing wallet or user information for withdrawal");
          setWithdrawalStatus("Missing wallet information");
          setTimeout(() => setWithdrawalStatus(null), 3000);
          return;
        }

        setIsWithdrawing(true);
        setWithdrawalStatus("Creating secure session...");

        try {
          // Validate wallet chain format for Coinbase compatibility
          const chainMapping: Record<string, string> = {
            base: "base",
          };

          const normalizedChain = chainMapping[wallet.chain.toLowerCase()] || wallet.chain;

          console.log("=== Withdrawal Debug Info ===", {
            originalChain: wallet.chain,
            normalizedChain,
            address: wallet.address,
            assets: ["USDC", "ETH"],
          });

          const token = await createCoinbaseSessionToken({
            address: wallet.address,
            blockchains: [normalizedChain],
            assets: ["USDC", "ETH"],
          });

          if (!token) {
            setWithdrawalStatus("Withdrawals require Coinbase API keys to be configured");
            setTimeout(() => setWithdrawalStatus(null), 3000);
            return;
          }

          setWithdrawalStatus("Redirecting to withdrawal...");

          const params = new URLSearchParams({
            sessionToken: token,
            partnerUserId: user.id,
            redirectUrl: window.location.origin,
          });

          const offrampUrl = `https://pay.coinbase.com/v3/sell/input?${params}`;

          // Small delay to show the "redirecting" message
          setTimeout(() => {
            window.location.href = offrampUrl;
          }, 500);
        } catch (error) {
          console.error(
            "Withdrawal failed:",
            error instanceof Error ? error.message : "Unknown error"
          );

          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          setWithdrawalStatus(`Error: ${errorMessage}`);
          setTimeout(() => setWithdrawalStatus(null), 5000);
        } finally {
          setIsWithdrawing(false);
        }
      },
      disabled: false,
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
        {(isWithdrawing || withdrawalStatus) && (
          <div className="ml-2 flex items-center space-x-2 text-sm">
            {isWithdrawing && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            )}
            <span
              className={`${withdrawalStatus?.startsWith("Error:") ? "text-red-600" : "text-gray-500"}`}
            >
              {withdrawalStatus || "Preparing withdrawal..."}
            </span>
          </div>
        )}
      </div>
      <WalletDetails onClose={() => setShowWalletDetails(false)} open={showWalletDetails} />
      <WarningModal open={openWarningModal} onClose={() => setOpenWarningModal(false)} />
    </Container>
  );
}
