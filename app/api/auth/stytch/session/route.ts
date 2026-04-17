import { NextRequest, NextResponse } from "next/server";
import { getStytchClient } from "@/lib/stytch";

/**
 * Validates a Stytch session server-side and returns session info.
 * Used by JwtSync to get a validated JWT for Crossmint BYOA.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionToken } = await request.json();

    if (!sessionToken) {
      return NextResponse.json({ error: "session_token is required" }, { status: 400 });
    }

    const stytch = getStytchClient();
    const response = await stytch.sessions.authenticate({
      session_token: sessionToken,
    });

    return NextResponse.json({
      userId: response.session.user_id,
      sessionId: response.session.session_id,
      expiresAt: response.session.expires_at,
    });
  } catch (err: any) {
    console.error("Stytch session validation failed:", err.message);
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }
}
