"use client";

import { useAuth } from "@/context/AuthContext";
import { CrossmintLoginModal } from "@/components/auth/CrossmintLoginModal";
import { useEffect } from "react";

export function Login() {
  const { login, status } = useAuth();

  useEffect(() => {
    if (status === "logged-out") {
      login();
    }
  }, [login, status]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <CrossmintLoginModal />
    </div>
  );
}
