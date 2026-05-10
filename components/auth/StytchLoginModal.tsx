"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStytch } from "@stytch/nextjs";
import { useAccount, useConnect, useDisconnect, useSignMessage, type Connector } from "wagmi";
import { OTPVerification } from "./OTPVerification";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/context/AuthContext";

type LoginStep = "choose" | "email-input" | "email-otp" | "wallet-pick";

const isMobileDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const connectorLabel = (connector: Connector): string => {
  const name = connector.name || connector.id;
  if (connector.id === "walletConnect") return "WalletConnect (Mobile / Other)";
  return name;
};

export function StytchLoginModal() {
  const stytch = useStytch();
  const { showLogin, setShowLogin, status } = useAuth();
  const [step, setStep] = useState<LoginStep>("choose");
  const [email, setEmail] = useState("");
  const [methodId, setMethodId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isWalletAuthing, setIsWalletAuthing] = useState(false);

  const { address, isConnected, connector: activeConnector } = useAccount();
  const { connectors, connectAsync, isPending: isConnectingWallet } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // Pick connectors that make sense for the current platform.
  // - Mobile: prefer WalletConnect (deep links to wallet apps)
  // - Desktop: prefer injected (MetaMask, Rabby, etc.)
  const orderedConnectors = useMemo(() => {
    const mobile = isMobileDevice();
    const list = connectors.filter((c) => c.id === "injected" || c.id === "walletConnect");
    return list.sort((a, b) => {
      if (a.id === b.id) return 0;
      if (mobile) {
        if (a.id === "walletConnect") return -1;
        if (b.id === "walletConnect") return 1;
      } else {
        if (a.id === "injected") return -1;
        if (b.id === "injected") return 1;
      }
      return 0;
    });
  }, [connectors]);

  useEffect(() => {
    if (status === "logged-in" && showLogin) {
      setShowLogin(false);
    }
  }, [status, showLogin, setShowLogin]);

  // Reset transient state whenever the modal closes
  useEffect(() => {
    if (showLogin) return;
    setStep("choose");
    setEmail("");
    setMethodId("");
    setError(null);
    setOtpError(null);
    setIsSendingEmail(false);
    setIsWalletAuthing(false);
  }, [showLogin]);

  const handleEmailSubmit = async () => {
    if (!email.trim() || isSendingEmail) return;
    setError(null);
    setOtpError(null);
    setIsSendingEmail(true);

    try {
      const response = await stytch.otps.email.loginOrCreate(email.trim());
      setMethodId(response.method_id);
      setStep("email-otp");
    } catch (err: unknown) {
      const message =
        (err as { message?: string } | null)?.message || "Failed to send verification code";
      setError(message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleOTPVerify = useCallback(
    async (code: string) => {
      // Throws are caught by OTPVerification and surfaced inline.
      await stytch.otps.authenticate(code, methodId, {
        session_duration_minutes: 10080, // 7 days
      });
    },
    [stytch, methodId]
  );

  const handleOTPResend = useCallback(async () => {
    if (!email) throw new Error("Missing email");
    const response = await stytch.otps.email.loginOrCreate(email.trim());
    setMethodId(response.method_id);
  }, [stytch, email]);

  // Attempt to authenticate the connected wallet against Stytch.
  const authenticateWalletWithStytch = useCallback(
    async (walletAddress: string) => {
      const { challenge } = await stytch.cryptoWallets.authenticateStart({
        crypto_wallet_address: walletAddress,
        crypto_wallet_type: "ethereum",
      });

      // Use wagmi (works for injected, WalletConnect, etc.) instead of raw window.ethereum,
      // which is undefined in mobile browsers without a wallet extension.
      const signature = await signMessageAsync({
        account: walletAddress as `0x${string}`,
        message: challenge,
      });

      await stytch.cryptoWallets.authenticate({
        crypto_wallet_address: walletAddress,
        crypto_wallet_type: "ethereum",
        signature,
        session_duration_minutes: 60 * 24 * 7,
      });
    },
    [stytch, signMessageAsync]
  );

  const handleConnectAndAuth = useCallback(
    async (connector: Connector) => {
      setError(null);
      setIsWalletAuthing(true);

      try {
        let walletAddress = address;

        if (!isConnected || !walletAddress) {
          const result = await connectAsync({ connector });
          walletAddress = result.accounts?.[0];
        }

        if (!walletAddress) {
          throw new Error("Could not get wallet address. Please try again.");
        }

        await authenticateWalletWithStytch(walletAddress);
        // Auth context detects the new session and closes the modal.
      } catch (err: unknown) {
        const e = err as { code?: number | string; message?: string } | null;
        // Codes: 4001 (user rejected), "ACTION_REJECTED" (ethers v6), "USER_REJECTED" (some libs)
        const rejected =
          e?.code === 4001 ||
          e?.code === "ACTION_REJECTED" ||
          e?.code === "USER_REJECTED" ||
          /reject/i.test(e?.message ?? "");
        if (!rejected) {
          setError(e?.message || "Wallet login failed. Please try again.");
        }
        // If we connected the wallet but failed Stytch auth, leave it connected
        // so the user can simply tap Sign Message again. Disconnect only on
        // hard error to avoid confusing reconnects.
      } finally {
        setIsWalletAuthing(false);
      }
    },
    [address, isConnected, connectAsync, authenticateWalletWithStytch]
  );

  const handleConnectWalletClick = useCallback(async () => {
    setError(null);

    // If only one connector is available, use it directly. Otherwise show picker.
    if (orderedConnectors.length === 0) {
      setError(
        "No wallet connectors available. Please configure WalletConnect or install a browser wallet."
      );
      return;
    }

    // Already connected? Re-use it for Stytch auth (signing only).
    if (isConnected && activeConnector) {
      await handleConnectAndAuth(activeConnector);
      return;
    }

    if (orderedConnectors.length === 1) {
      await handleConnectAndAuth(orderedConnectors[0]);
      return;
    }

    setStep("wallet-pick");
  }, [orderedConnectors, isConnected, activeConnector, handleConnectAndAuth]);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const redirectUrl =
        typeof window !== "undefined" ? `${window.location.origin}/api/auth/stytch/callback` : "";
      stytch.oauth.google.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (err: unknown) {
      const message = (err as { message?: string } | null)?.message || "Google login failed";
      setError(message);
    }
  };

  const resetFlow = () => {
    setStep("choose");
    setEmail("");
    setMethodId("");
    setError(null);
    setOtpError(null);
  };

  const isBusy = isSendingEmail || isWalletAuthing || isConnectingWallet;

  return (
    <Modal
      open={showLogin}
      onClose={() => setShowLogin(false)}
      showBackButton={step !== "choose"}
      onBack={resetFlow}
      title="Welcome to CREATIVE Finance"
    >
      <div className="flex flex-col items-center gap-6 py-4">
        {step === "choose" && (
          <>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Sign in to access your account
            </p>

            {error && (
              <p className="text-center text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="flex w-full flex-col gap-3">
              <PrimaryButton onClick={() => setStep("email-input")} disabled={isBusy}>
                Continue with Email
              </PrimaryButton>

              <button
                onClick={handleGoogleLogin}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-500">or</span>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>

              <button
                onClick={handleConnectWalletClick}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {isWalletAuthing || isConnectingWallet ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>

            <p className="text-center text-xs text-gray-500">
              By continuing, you accept the{" "}
              <a
                href="https://www.crossmint.com/legal/terms-of-service"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Wallet&apos;s Terms of Service
              </a>
              , and to receive marketing communications from Creative Org DAO.
            </p>
          </>
        )}

        {step === "wallet-pick" && (
          <>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Choose how to connect your wallet
            </p>

            {error && (
              <p className="text-center text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="flex w-full flex-col gap-3">
              {orderedConnectors.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => handleConnectAndAuth(c)}
                  disabled={isBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {connectorLabel(c)}
                </button>
              ))}
              {isConnected && (
                <button
                  onClick={() => disconnect()}
                  disabled={isBusy}
                  className="text-xs text-gray-500 underline disabled:opacity-50"
                >
                  Disconnect current wallet
                </button>
              )}
            </div>
          </>
        )}

        {step === "email-input" && (
          <>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Enter your email to receive a verification code
            </p>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleEmailSubmit()}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />

            {error && (
              <p className="text-center text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <PrimaryButton onClick={handleEmailSubmit} disabled={!email.trim() || isSendingEmail}>
              {isSendingEmail ? "Sending..." : "Send Code"}
            </PrimaryButton>
          </>
        )}

        {step === "email-otp" && (
          <OTPVerification
            type="email"
            destination={email}
            onVerify={handleOTPVerify}
            onResend={handleOTPResend}
            error={otpError}
          />
        )}
      </div>
    </Modal>
  );
}
