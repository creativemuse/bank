"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStytch, useStytchUser } from "@stytch/nextjs";

type AuthStatus = "logged-out" | "logged-in" | "initializing";

interface AuthUser {
  id: string;
  email: string;
  /** Set when the user signed in with email OTP (no extra deposit step). */
  emailVerifiedAt?: string;
  phoneNumber?: string;
  phoneNumberVerifiedAt?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  jwt: string | null;
  /** @deprecated Use `jwt` — kept for API routes that still accept sessionToken in bodies */
  sessionToken: string | null;
  login: () => void;
  logout: () => Promise<void>;
  showLogin: boolean;
  setShowLogin: (show: boolean) => void;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stytch = useStytch();
  const { user: stytchUser, isInitialized } = useStytchUser();

  const [showLogin, setShowLogin] = useState(false);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | undefined>();
  const [phoneNumberVerifiedAt, setPhoneNumberVerifiedAt] = useState<string | undefined>();
  const [jwt, setJwt] = useState<string | null>(null);

  useEffect(() => {
    const syncJwt = () => {
      setJwt(stytch.session.getTokens()?.session_jwt ?? null);
    };

    syncJwt();
    const unsubscribe = stytch.session.onChange(syncJwt);
    return unsubscribe;
  }, [stytch]);

  const status: AuthStatus = useMemo(() => {
    if (!isInitialized) return "initializing";
    if (jwt && stytchUser) return "logged-in";
    return "logged-out";
  }, [isInitialized, jwt, stytchUser]);

  const user: AuthUser | null = useMemo(() => {
    if (!stytchUser) return null;

    const email = stytchUser.emails?.[0]?.email ?? "";

    return {
      id: stytchUser.user_id,
      email,
      emailVerifiedAt,
      phoneNumber: stytchUser.phone_numbers?.[0]?.phone_number,
      phoneNumberVerifiedAt,
    };
  }, [stytchUser, emailVerifiedAt, phoneNumberVerifiedAt]);

  const refreshUserProfile = useCallback(async () => {
    if (!jwt) {
      setEmailVerifiedAt(undefined);
      setPhoneNumberVerifiedAt(undefined);
      return;
    }

    try {
      const response = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      if (data.emailVerifiedAt) {
        setEmailVerifiedAt(data.emailVerifiedAt);
      }
      if (data.phoneNumberVerifiedAt) {
        setPhoneNumberVerifiedAt(data.phoneNumberVerifiedAt);
      }
    } catch {
      // Profile fetch is best-effort (warm start for Coinbase onramp)
    }
  }, [jwt]);

  useEffect(() => {
    if (status === "logged-in") {
      void refreshUserProfile();
    } else {
      setEmailVerifiedAt(undefined);
      setPhoneNumberVerifiedAt(undefined);
    }
  }, [status, refreshUserProfile]);

  const login = useCallback(() => {
    setShowLogin(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await stytch.session.revoke();
    } catch {
      // Session may already be expired
    }
    setEmailVerifiedAt(undefined);
    setPhoneNumberVerifiedAt(undefined);
    setShowLogin(true);
  }, [stytch]);

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      user,
      jwt,
      sessionToken: jwt,
      login,
      logout,
      showLogin,
      setShowLogin,
      refreshUserProfile,
    }),
    [status, user, jwt, login, logout, showLogin, refreshUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
