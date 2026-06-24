"use client";

import { useAuth } from "@/context/AuthContext";
import { StytchLoginModal } from "@/components/auth/StytchLoginModal";
import { useEffect } from "react";

export function Login() {
  const { login, status } = useAuth();

  useEffect(() => {
    if (status === "logged-out") {
      login();
    }
  }, [login, status]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <StytchLoginModal />
    </div>
  );
}
