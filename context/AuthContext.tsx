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
import { useStytch, useStytchSession, useStytchUser } from "@stytch/nextjs";

type AuthStatus = "logged-out" | "logged-in" | "initializing";

interface AuthUser {
  id: string;
  email: string;
  phoneNumber?: string;
  phoneNumberVerifiedAt?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  jwt: string | null;
  login: () => void;
  logout: () => void;
  showLogin: boolean;
  setShowLogin: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stytch = useStytch();
  const { session } = useStytchSession();
  const { user: stytchUser, isInitialized } = useStytchUser();
  const [showLogin, setShowLogin] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);

  const status: AuthStatus = useMemo(() => {
    if (!isInitialized) return "initializing";
    if (session && stytchUser) return "logged-in";
    return "logged-out";
  }, [isInitialized, session, stytchUser]);

  const user: AuthUser | null = useMemo(() => {
    if (!stytchUser) return null;

    const primaryEmail =
      stytchUser.emails?.find((e) => e.verified)?.email ?? stytchUser.emails?.[0]?.email ?? "";

    const verifiedPhone = stytchUser.phone_numbers?.find((p) => p.verified);
    const phoneNumberVerifiedAt = stytchUser.trusted_metadata?.phoneNumberVerifiedAt as
      | string
      | undefined;

    return {
      id: stytchUser.user_id,
      email: primaryEmail,
      phoneNumber: verifiedPhone?.phone_number,
      phoneNumberVerifiedAt,
    };
  }, [stytchUser]);

  // Fetch session JWT for Crossmint BYOA
  useEffect(() => {
    if (!session) {
      setJwt(null);
      return;
    }

    const tokens = stytch.session.getTokens();
    if (tokens?.session_jwt) {
      setJwt(tokens.session_jwt);
    }
  }, [session, stytch.session]);

  // Refresh JWT when session ID changes (handles background refreshes)
  useEffect(() => {
    if (!session?.session_id) return;

    const tokens = stytch.session.getTokens();
    if (tokens?.session_jwt) {
      setJwt(tokens.session_jwt);
    }
  }, [session?.session_id, stytch.session]);

  const login = useCallback(() => {
    setShowLogin(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await stytch.session.revoke();
    } catch {
      // Session may already be expired
    }
    setJwt(null);
    setShowLogin(false);
  }, [stytch.session]);

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      user,
      jwt,
      login,
      logout,
      showLogin,
      setShowLogin,
    }),
    [status, user, jwt, login, logout, showLogin]
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
