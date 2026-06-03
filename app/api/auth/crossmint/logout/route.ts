import { NextRequest, NextResponse } from "next/server";
import { getCrossmintAuth } from "@/lib/crossmint-server";

/** Crossmint auth cookie names (see @crossmint/common-sdk-auth). */
const CROSSMINT_AUTH_COOKIES = ["crossmint-jwt", "crossmint-refresh-token"];

/**
 * Always returns a response that clears the Crossmint auth cookies, so the
 * client can recover from a broken/expired session even if the SDK logout
 * call fails.
 */
function clearAuthCookies(status: number): NextResponse {
  const response = NextResponse.json({ success: status === 200 }, { status });
  for (const name of CROSSMINT_AUTH_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}

/**
 * POST /api/auth/crossmint/logout
 * Clears Crossmint Auth session (used by CrossmintAuthProvider).
 */
export async function POST(request: NextRequest) {
  try {
    const crossmintAuth = getCrossmintAuth();
    return (await crossmintAuth.logout(request)) as Response;
  } catch (error) {
    console.error("[Crossmint Auth] Logout failed:", error);
    // Clear cookies and return 200 so the user is not stuck with a stale
    // session that cannot be cleared.
    return clearAuthCookies(200);
  }
}
