"use client";

import { useEffect, useMemo } from "react";
import { StytchLogin, OAuthProviders, OTPMethods, Products } from "@stytch/nextjs";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/context/AuthContext";
import styles from "./StytchLoginModal.module.css";

const loginModalTitle = (
  <>
    Welcome to <span style={{ fontFamily: "var(--font-conthrax), sans-serif" }}>CREATIVE</span>{" "}
    Finance
  </>
);

const getDefaultRedirectUrl = () => {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://bank.creativeplatform.xyz"
      : "http://localhost:3000");
  return `${siteUrl}/authenticate`;
};

export function StytchLoginModal() {
  const { showLogin, setShowLogin, status } = useAuth();
  const isLoggedOut = status === "logged-out";
  const modalOpen = isLoggedOut || showLogin;

  const authRedirectUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/authenticate`;
    }
    return getDefaultRedirectUrl();
  }, []);

  const stytchLoginConfig = useMemo(
    () => ({
      products: [Products.otp, Products.oauth],
      otpOptions: {
        methods: [OTPMethods.Email],
        expirationMinutes: 10,
      },
      oauthOptions: {
        providers: [{ type: OAuthProviders.Google }],
        loginRedirectURL: authRedirectUrl,
        signupRedirectURL: authRedirectUrl,
      },
    }),
    [authRedirectUrl]
  );

  useEffect(() => {
    if (status === "logged-in" && showLogin) {
      setShowLogin(false);
    }
  }, [status, showLogin, setShowLogin]);

  const handleClose = () => {
    if (isLoggedOut) return;
    setShowLogin(false);
  };

  return (
    <Modal open={modalOpen} onClose={handleClose} title={loginModalTitle}>
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">Google or Email</p>
        <div className={`${styles.stytchFormWrap} w-full`}>
          <StytchLogin config={stytchLoginConfig} />
        </div>
        <p className="text-center text-xs text-gray-500">
          By continuing, you accept the{" "}
          <a
            href="https://www.crossmint.com/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Wallet&apos;s Terms of Service
          </a>
          , and to receive marketing communications from Creative Org DAO.
        </p>
      </div>
    </Modal>
  );
}
