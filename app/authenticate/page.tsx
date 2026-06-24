"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStytch, useStytchUser } from "@stytch/nextjs";

const SESSION_DURATION_MINUTES = 60 * 24 * 30;

export default function AuthenticatePage() {
  const stytch = useStytch();
  const { user, isInitialized } = useStytchUser();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    if (user) {
      router.replace("/");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const tokenType = params.get("stytch_token_type");

    if (!token || !tokenType) return;

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
        }
        router.replace("/");
      } catch (error) {
        console.error("[Stytch] OAuth/magic link authenticate failed:", error);
        router.replace("/");
      }
    };

    void handleAuthenticate();
  }, [isInitialized, user, stytch, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}
