"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCrossmintAuth } from "@crossmint/client-sdk-react-ui";

type AuthStatus = "logged-out" | "logged-in" | "initializing";

interface AuthUser {
  id: string;
  email: string;
  phoneNumber?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Crossmint session JWT for Authorization: Bearer headers */
  jwt: string | null;
  /** @deprecated Use jwt — kept for API routes that still read sessionToken from the body */
  sessionToken: string | null;
  login: () => void;
  logout: () => void;
  showLogin: boolean;
  setShowLogin: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthStatus(
  crossmintStatus: "logged-in" | "logged-out" | "in-progress" | "initializing"
): AuthStatus {
  if (crossmintStatus === "logged-in") return "logged-in";
  if (crossmintStatus === "initializing" || crossmintStatus === "in-progress") {
    return "initializing";
  }
  return "logged-out";
}

/**
 * Bridges Crossmint Auth into the app-wide useAuth() interface.
 * Must be rendered inside CrossmintAuthProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const crossmintAuth = useCrossmintAuth();
  const [showLogin, setShowLogin] = useState(false);

  const user: AuthUser | null = useMemo(() => {
    if (!crossmintAuth.user) return null;
    return {
      id: crossmintAuth.user.id,
      email: crossmintAuth.user.email ?? "",
      phoneNumber: crossmintAuth.user.phoneNumber,
    };
  }, [crossmintAuth.user]);

  const status = mapAuthStatus(crossmintAuth.status);
  const jwt = crossmintAuth.jwt ?? null;

  const login = useCallback(() => {
    setShowLogin(true);
    crossmintAuth.login();
  }, [crossmintAuth]);

  const logout = useCallback(async () => {
    setShowLogin(false);
    await crossmintAuth.logout();
  }, [crossmintAuth]);

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
