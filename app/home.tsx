"use client";

import { useEffect, useState } from "react";
import { Login } from "@/components/Login";
import { MainScreen } from "@/components/MainScreen";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useProcessWithdrawal } from "@/hooks/useProcessWithdrawal";
import { useMembership } from "@/context/MembershipContext";
import { useWalletProvisioning } from "@/context/WalletProvisioningContext";
import { upsertUser } from "@/server-actions/getTransactions";
import { MembershipOnboarding } from "@/components/unlock/MembershipOnboarding";
import { isInAppBrowser } from "@/lib/passkeySupport";

const ONBOARDING_DISMISSED_KEY = "has_seen_membership_onboarding";

export function HomeContent() {
  const { wallet, status: walletStatus } = useWallet();
  const { status, status: authStatus, user, logout } = useAuth();
  const { tier, isLoading: membershipLoading, refresh: refreshMembership } = useMembership();
  const {
    errorMessage: provisioningError,
    stage: provisioningStage,
    requestRetry,
  } = useWalletProvisioning();

  const [hasDismissedOnboarding, setHasDismissedOnboarding] = useState(true); // default true to avoid flash
  const [inAppBrowser, setInAppBrowser] = useState(false);

  useProcessWithdrawal(wallet?.address, wallet);

  const walletAddress = wallet?.address;
  const isLoggedIn = wallet != null && status === "logged-in";
  // Only show the spinner while we are actively trying to provision. Once the
  // provisioner publishes an error, fall through to the recoverable error UI
  // so the user isn't stuck on a spinner.
  const isLoading =
    authStatus === "initializing" ||
    (authStatus === "logged-in" &&
      walletStatus !== "loaded" &&
      walletStatus !== "error" &&
      !provisioningError);
  const hasMembership = !membershipLoading && tier !== null;

  // Detect once on mount; UA strings don't change at runtime.
  useEffect(() => {
    setInAppBrowser(isInAppBrowser());
  }, []);

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

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Older WebViews don't have clipboard.writeText; users can fall back
      // to the explicit "Open in browser" instructions in the modal copy.
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  // Show the recoverable wallet-provisioning error screen when either:
  //  - Crossmint reports a hard `error` status, or
  //  - our provisioner published an error (e.g. fallback also failed).
  const showWalletErrorScreen =
    authStatus === "logged-in" && (walletStatus === "error" || !!provisioningError);

  if (showWalletErrorScreen) {
    const friendlyError =
      provisioningError ?? "Something went wrong while provisioning your wallet.";
    const triedFallback = provisioningStage === "email-fallback";

    return (
      <div className="mx-auto flex h-full w-full max-w-sm items-center justify-center px-6">
        <div className="bg-card text-card-foreground flex w-full flex-col items-center gap-4 rounded-2xl p-6 text-center shadow-xl">
          <h2 className="text-xl font-semibold">We couldn&apos;t set up your wallet</h2>
          <p className="text-muted-foreground text-sm">{friendlyError}</p>

          {inAppBrowser && (
            <div
              role="alert"
              className="w-full rounded-lg border border-amber-300/40 bg-amber-50/95 p-3 text-left text-xs text-amber-900"
            >
              <p className="font-semibold">You&apos;re in an in-app browser.</p>
              <p className="mt-1">
                Wallet creation requires a full browser. Tap the menu (
                <span aria-hidden="true">⋮</span>) at the top of this view and choose{" "}
                <strong>Open in browser</strong> (Chrome on Android, Safari on iOS), then sign in
                again.
              </p>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="mt-2 inline-flex items-center justify-center rounded-md border border-amber-700/30 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50"
              >
                Copy page URL
              </button>
            </div>
          )}

          <div className="flex w-full flex-col gap-2">
            <PrimaryButton onClick={requestRetry}>
              {triedFallback ? "Try again" : "Try again with email signer"}
            </PrimaryButton>
            <button
              type="button"
              onClick={logout}
              className="border-border w-full rounded-full border py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </div>
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
