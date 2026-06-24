"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StytchEventType, StytchLogin, useStytch, useStytchSession, useStytchUser } from "@stytch/nextjs";

import {
  getAuthRedirectUrl,
  getStytchLoginConfig,
  SESSION_DURATION_MINUTES,
} from "@/lib/stytchLoginConfig";
import styles from "@/components/auth/StytchLoginModal.module.css";

type AuthState = "loading" | "error";

export default function AuthenticatePage() {
  const stytch = useStytch();
  const { user, isInitialized: userInitialized } = useStytchUser();
  const { session, isInitialized: sessionInitialized } = useStytchSession();
  const router = useRouter();
  const [state, setState] = useState<AuthState>("loading");
  const authStartedRef = useRef(false);
  const initialHrefRef = useRef<string | undefined>(undefined);

  if (typeof window !== "undefined" && initialHrefRef.current === undefined) {
    initialHrefRef.current = window.location.href;
  }

  const authRedirectUrl = useMemo(() => getAuthRedirectUrl(), []);
  const stytchLoginConfig = useMemo(
    () => getStytchLoginConfig(authRedirectUrl),
    [authRedirectUrl]
  );

  useEffect(() => {
    const unsubscribe = stytch.session.onChange((nextSession) => {
      if (nextSession) {
        router.replace("/");
      }
    });
    return unsubscribe;
  }, [stytch, router]);

  useEffect(() => {
    if (!userInitialized || !sessionInitialized) return;

    if (user && session) {
      router.replace("/");
      return;
    }

    if (authStartedRef.current) return;
    authStartedRef.current = true;

    const href = initialHrefRef.current ?? window.location.href;
    const parsed = stytch.parseAuthenticateUrl(href);

    if (!parsed) {
      setState("error");
      return;
    }

    if (!parsed.handled) {
      console.error("[Stytch] Unsupported callback token type:", parsed.tokenType);
      setState("error");
      return;
    }

    const handleAuthenticate = async () => {
      try {
        const result = await stytch.authenticateByUrl(
          { session_duration_minutes: SESSION_DURATION_MINUTES },
          href
        );

        if (!result?.handled) {
          setState("error");
          return;
        }

        router.replace("/");
      } catch (error) {
        console.error("[Stytch] authenticateByUrl failed:", error);
        setState("error");
      }
    };

    void handleAuthenticate();
  }, [userInitialized, sessionInitialized, user, session, stytch, router]);

  const handleAuthComplete = () => {
    router.replace("/");
  };

  if (state === "error") {
    return (
      <div className="flex h-screen w-full items-center justify-center px-6">
        <div className="bg-card text-card-foreground flex max-w-sm flex-col items-center gap-4 rounded-2xl p-6 text-center shadow-xl">
          <h1 className="text-lg font-semibold">Sign-in link invalid or expired</h1>
          <p className="text-muted-foreground text-sm">
            This authentication link is missing required parameters or could not be completed. Please
            try signing in again.
          </p>
          <div className={`${styles.stytchFormWrap} w-full`}>
            <StytchLogin
              config={stytchLoginConfig}
              callbacks={{
                onEvent: ({ type }) => {
                  if (type === StytchEventType.AuthenticateFlowComplete) {
                    handleAuthComplete();
                  }
                },
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="text-muted-foreground text-sm underline"
          >
            Back to home
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
