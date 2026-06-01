"use client";

import { EmbeddedAuthForm } from "@crossmint/client-sdk-react-ui";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export function CrossmintLoginModal() {
  const { showLogin, setShowLogin, status } = useAuth();

  useEffect(() => {
    if (status === "logged-in") {
      setShowLogin(false);
    }
  }, [status, setShowLogin]);

  if (!showLogin && status !== "logged-out") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={() => setShowLogin(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-800"
          aria-label="Close sign in"
        >
          ✕
        </button>
        <EmbeddedAuthForm />
      </div>
    </div>
  );
}
