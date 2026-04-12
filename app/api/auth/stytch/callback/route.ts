import { NextRequest, NextResponse } from "next/server";
import { getStytchClient } from "@/lib/stytch";

/**
 * Handles OAuth (Google) and Magic Link callbacks from Stytch.
 * Authenticates the token, sets session cookies so the client-side
 * Stytch SDK can detect the session, then redirects to the app.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const stytchTokenType = searchParams.get("stytch_token_type");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=missing_token", request.url));
  }

  const stytch = getStytchClient();

  try {
    let sessionToken: string | undefined;
    let sessionJwt: string | undefined;

    if (stytchTokenType === "oauth") {
      const response = await stytch.oauth.authenticate({
        token,
        session_duration_minutes: 10080, // 7 days
      });
      sessionToken = response.session_token;
      sessionJwt = response.session_jwt;
    } else if (stytchTokenType === "magic_links") {
      const response = await stytch.magicLinks.authenticate({
        token,
        session_duration_minutes: 60 * 24 * 7,
      });
      sessionToken = response.session_token;
      sessionJwt = response.session_jwt;
    } else {
      return NextResponse.redirect(
        new URL("/?error=invalid_token_type", request.url),
      );
    }

    // Redirect to home and set session cookies so the client-side
    // Stytch SDK automatically picks up the authenticated session
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));

    if (sessionToken) {
      redirectResponse.cookies.set("stytch_session", sessionToken, {
        httpOnly: false, // Client-side SDK needs to read this
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      });
    }

    if (sessionJwt) {
      redirectResponse.cookies.set("stytch_session_jwt", sessionJwt, {
        httpOnly: false, // Client-side SDK needs to read this
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return redirectResponse;
  } catch (err: any) {
    console.error("Stytch callback authentication failed:", err.message);
    return NextResponse.redirect(
      new URL("/?error=auth_failed", request.url),
    );
  }
}
