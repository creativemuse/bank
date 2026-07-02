"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";
import { provisionCrossmintWallet } from "@/lib/walletProvisioning";

/**
 * Provisions the Crossmint smart wallet after auth, with passkey as the preferred
 * operational signer and email OTP recovery tied to the signed-in user's email.
 * Falls back to the default device signer when passkeys are unavailable or fail.
 */
export const WalletProvisioner = () => {
  const { status: authStatus, user } = useAuth();
  const { wallet, status: walletStatus, createWallet, getWallet } = useWallet();
  const isProvisioningRef = useRef(false);

  useEffect(() => {
    if (authStatus !== "logged-in") return;
    if (walletStatus === "loaded" && wallet) return;
    if (walletStatus === "in-progress" || isProvisioningRef.current) return;

    if (walletStatus !== "not-loaded" && walletStatus !== "error") return;

    const provisionWallet = async () => {
      isProvisioningRef.current = true;

      try {
        await provisionCrossmintWallet({ getWallet, createWallet }, user?.email);
      } finally {
        isProvisioningRef.current = false;
      }
    };

    void provisionWallet();
  }, [authStatus, wallet, walletStatus, user?.email, createWallet, getWallet]);

  return null;
};
