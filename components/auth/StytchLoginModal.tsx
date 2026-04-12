"use client";

import { useState, useEffect } from "react";
import { useStytch } from "@stytch/nextjs";
import { OTPVerification } from "./OTPVerification";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/context/AuthContext";

type LoginStep = "choose" | "email-input" | "email-otp";

export function StytchLoginModal() {
  const stytch = useStytch();
  const { showLogin, setShowLogin, status } = useAuth();
  const [step, setStep] = useState<LoginStep>("choose");
  const [email, setEmail] = useState("");
  const [methodId, setMethodId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Close modal when logged in
  useEffect(() => {
    if (status === "logged-in" && showLogin) {
      setShowLogin(false);
    }
  }, [status, showLogin, setShowLogin]);

  const handleEmailSubmit = async () => {
    if (!email.trim()) return;
    setError(null);
    setIsLoading(true);

    try {
      const response = await stytch.otps.email.loginOrCreate(email.trim());
      setMethodId(response.method_id);
      setStep("email-otp");
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerify = async (code: string) => {
    try {
      await stytch.otps.authenticate(code, methodId, {
        session_duration_minutes: 10080, // 7 days
      });
      // Auth context will detect the session and update status
    } catch (err: any) {
      throw err;
    }
  };

  const handleOTPResend = async () => {
    const response = await stytch.otps.email.loginOrCreate(email.trim());
    setMethodId(response.method_id);
  };

  const handleCryptoWalletLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Request signature from connected wallet (EVM)
      const { ethereum } = window as any;
      if (!ethereum) {
        setError("No wallet detected. Please install MetaMask or another wallet.");
        setIsLoading(false);
        return;
      }

      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];

      // Start Stytch crypto wallet auth
      const { challenge } = await stytch.cryptoWallets.authenticateStart({
        crypto_wallet_address: address,
        crypto_wallet_type: "ethereum",
      });

      // Sign the challenge
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [challenge, address],
      });

      // Complete authentication
      await stytch.cryptoWallets.authenticate({
        crypto_wallet_address: address,
        crypto_wallet_type: "ethereum",
        signature,
        session_duration_minutes: 60 * 24 * 7,
      });
    } catch (err: any) {
      if (err.code !== 4001) {
        // 4001 = user rejected
        setError(err.message || "Wallet login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/api/auth/stytch/callback`
          : "";
      stytch.oauth.google.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (err: any) {
      setError(err.message || "Google login failed");
    }
  };

  const resetFlow = () => {
    setStep("choose");
    setEmail("");
    setMethodId("");
    setError(null);
  };

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

            {error && <p className="text-center text-sm text-red-500">{error}</p>}

            <div className="flex w-full flex-col gap-3">
              <PrimaryButton onClick={() => setStep("email-input")} disabled={isLoading}>
                Continue with Email
              </PrimaryButton>

              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
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
                onClick={handleCryptoWalletLogin}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Connect Wallet
              </button>
            </div>

            <p className="text-center text-xs text-gray-500">
              By continuing, you accept the{" "}
              <a
                href="https://www.crossmint.com/legal/terms-of-service"
                target="_blank"
                className="text-blue-600 underline"
              >
                Wallet&apos;s Terms of Service
              </a>
              , and to receive marketing communications from Creative Org DAO.
            </p>
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
              onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
              placeholder="you@example.com"
              autoFocus
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />

            {error && <p className="text-center text-sm text-red-500">{error}</p>}

            <PrimaryButton
              onClick={handleEmailSubmit}
              disabled={!email.trim() || isLoading}
            >
              {isLoading ? "Sending..." : "Send Code"}
            </PrimaryButton>
          </>
        )}

        {step === "email-otp" && (
          <OTPVerification
            type="email"
            destination={email}
            onVerify={handleOTPVerify}
            onResend={handleOTPResend}
            error={error}
          />
        )}
      </div>
    </Modal>
  );
}
