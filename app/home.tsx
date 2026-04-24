"use client";

import { useEffect, useState } from "react";
import { Login } from "@/components/Login";
import { MainScreen } from "@/components/MainScreen";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useProcessWithdrawal } from "@/hooks/useProcessWithdrawal";
import { useMembership } from "@/context/MembershipContext";
import { upsertUser } from "@/server-actions/getTransactions";
import { MembershipOnboarding } from "@/components/unlock/MembershipOnboarding";

const ONBOARDING_DISMISSED_KEY = "has_seen_membership_onboarding";

export function HomeContent() {
  const { wallet, status: walletStatus } = useWallet();
  const { status, status: authStatus, user, logout } = useAuth();
  const { tier, isLoading: membershipLoading, refresh: refreshMembership } = useMembership();

  const [hasDismissedOnboarding, setHasDismissedOnboarding] = useState(true); // default true to avoid flash

  useProcessWithdrawal(wallet?.address, wallet);

  const walletAddress = wallet?.address;
  const isLoggedIn = wallet != null && status === "logged-in";
  const isLoading =
    authStatus === "initializing" ||
    (authStatus === "logged-in" && walletStatus !== "loaded" && walletStatus !== "error");
  const hasMembership = !membershipLoading && tier !== null;

  // Check localStorage for onboarding dismissal on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY);
    setHasDismissedOnboarding(dismissed === "true");
  }, []);

  // Sync Stytch user identity → CockroachDB on login
  useEffect(() => {
    if (isLoggedIn && user?.id && walletAddress) {
      upsertUser(user.id, walletAddress, user.email, user.phoneNumber);
    }
  }, [isLoggedIn, user?.id, walletAddress, user?.email, user?.phoneNumber]);

  const handleSkipOnboarding = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    setHasDismissedOnboarding(true);
  };

  const handlePurchaseComplete = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    setHasDismissedOnboarding(true);
    refreshMembership();
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (authStatus === "logged-in" && walletStatus === "error") {
    return (
      <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center px-6 text-center">
        <h2 className="text-xl font-semibold">We couldn't set up your wallet</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Something went wrong while provisioning your wallet. Sign out and try again.
        </p>
        <PrimaryButton onClick={logout}>Sign out</PrimaryButton>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login />;
  }

  // Show membership onboarding for first-time non-members
  if (!membershipLoading && !hasMembership && !hasDismissedOnboarding) {
    return (
      <MembershipOnboarding
        onSkip={handleSkipOnboarding}
        onPurchaseComplete={handlePurchaseComplete}
      />
    );
  }

  return <MainScreen walletAddress={walletAddress} />;
}
