"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStytch, useStytchUser } from "@stytch/nextjs";

const SESSION_DURATION_MINUTES = 60 * 24 * 30;

type AuthState = "loading" | "error";

export default function AuthenticatePage() {
  const stytch = useStytch();
  const { user, isInitialized } = useStytchUser();
  const router = useRouter();
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    if (!isInitialized) return;

    if (user) {
      router.replace("/");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const tokenType = params.get("stytch_token_type");

    if (!token || !tokenType) {
      setState("error");
      return;
    }

    const handleAuthenticate = async () => {
      try {
        if (tokenType === "oauth") {
          await stytch.oauth.authenticate(token, {
            session_duration_minutes: SESSION_DURATION_MINUTES,
          });
        } else if (tokenType === "magic_links") {
          await stytch.magicLinks.authenticate(token, {
            session_duration_minutes: SESSION_DURATION_MINUTES,
          });
        } else {
          setState("error");
          return;
        }
        router.replace("/");
      } catch (error) {
        console.error("[Stytch] OAuth/magic link authenticate failed:", error);
        setState("error");
      }
    };

    void handleAuthenticate();
  }, [isInitialized, user, stytch, router]);

  if (state === "error") {
    return (
      <div className="flex h-screen w-full items-center justify-center px-6">
        <div className="bg-card text-card-foreground flex max-w-sm flex-col items-center gap-4 rounded-2xl p-6 text-center shadow-xl">
          <h1 className="text-lg font-semibold">Sign-in link invalid or expired</h1>
          <p className="text-muted-foreground text-sm">
            This authentication link is missing required parameters or could not be completed. Please
            try signing in again.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="bg-primary text-primary-foreground w-full rounded-full px-4 py-3 text-sm font-medium"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}
