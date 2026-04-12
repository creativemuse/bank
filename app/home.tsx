"use client";

import { useEffect } from "react";
import { Login } from "@/components/Login";
import { MainScreen } from "@/components/MainScreen";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useProcessWithdrawal } from "@/hooks/useProcessWithdrawal";
import { upsertUser } from "@/server-actions/getTransactions";

export function HomeContent() {
  const { wallet, status: walletStatus } = useWallet();
  const { status, status: authStatus, user } = useAuth();

  useProcessWithdrawal(wallet?.address, wallet);

  const walletAddress = wallet?.address;
  const isLoggedIn = wallet != null && status === "logged-in";
  const isLoading = walletStatus === "in-progress" || authStatus === "initializing";

  // Sync Stytch user identity → CockroachDB on login
  useEffect(() => {
    if (isLoggedIn && user?.id && walletAddress) {
      upsertUser(user.id, walletAddress, user.email, user.phoneNumber);
    }
  }, [isLoggedIn, user?.id, walletAddress, user?.email, user?.phoneNumber]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login />;
  }

  return <MainScreen walletAddress={walletAddress} />;
}
