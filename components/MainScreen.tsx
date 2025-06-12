import Image from "next/image";
import { useState } from "react";
import { DepositModal } from "@/components/deposit";
import { SendFundsModal } from "@/components/send-funds";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useAuth } from "@crossmint/client-sdk-react-ui";
import { NewProducts } from "./NewProducts";
import { DashboardSummary } from "./dashboard-summary";

interface MainScreenProps {
  walletAddress?: string;
}

export function MainScreen({ walletAddress }: MainScreenProps) {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="flex h-full w-full items-center justify-center gap-2 px-3 py-8">
      <div className="h-full w-full max-w-5xl">
        <div className="relative mb-2 flex h-14 w-full max-w-5xl items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Image src="/creative.svg" alt="Logo" width={54} height={54} />
            <h1 className="text-lg" style={{ fontFamily: "ConthraxSb-Regular , sans-serif" }}>
              CREATIVE
              <span
                className="text-md ml-1 font-bold text-red-500"
                style={{ fontFamily: "sans-serif" }}
              >
                BANK
              </span>
            </h1>
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-medium">
            Dashboard
          </div>
          <button onClick={logout} className="text-secondary flex items-center gap-1 text-base">
            Logout
            <Image src="/logout-icon.svg" alt="Logout" width={24} height={24} />
          </button>
        </div>
        <DashboardSummary
          onDepositClick={() => setShowDepositModal(true)}
          onSendClick={() => setShowSendModal(true)}
        />
        <NewProducts />
        <ActivityFeed onDepositClick={() => setShowDepositModal(true)} />
        <DepositModal
          open={showDepositModal}
          onClose={() => setShowDepositModal(false)}
          walletAddress={walletAddress || ""}
        />
        <SendFundsModal open={showSendModal} onClose={() => setShowSendModal(false)} />
      </div>
    </div>
  );
}
