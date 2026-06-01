import { NextRequest } from "next/server";
import { getCrossmintAuth } from "@/lib/crossmint-server";

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
    return Response.json({ error: "Failed to logout" }, { status: 500 });
  }
}
