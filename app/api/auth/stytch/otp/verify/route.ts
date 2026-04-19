import { NextRequest, NextResponse } from "next/server";
import { getStytchClient } from "@/lib/stytch";

/**
 * Verifies an OTP code via the Stytch Node SDK.
 * On successful phone verification, updates the user's trusted_metadata
 * with phoneNumberVerifiedAt timestamp to enable the "Warm Start"
 * skip-OTP logic for repeat Coinbase onramp deposits.
 */
export async function POST(request: NextRequest) {
  try {
    const { methodId, code, type } = await request.json();

    if (!methodId || !code) {
      return NextResponse.json({ error: "methodId and code are required" }, { status: 400 });
    }

    const stytch = getStytchClient();

    const response = await stytch.otps.authenticate({
      method_id: methodId,
      code,
      session_duration_minutes: 10080, // 7 days
    });

    // If this was a phone verification, store the verification timestamp
    // in the user's trusted_metadata for Coinbase "Warm Start"
    if (type === "sms" && response.user_id) {
      try {
        await stytch.users.update({
          user_id: response.user_id,
          trusted_metadata: {
            phoneNumberVerifiedAt: new Date().toISOString(),
          },
        });
      } catch (metadataErr: any) {
        // Non-critical: log but don't fail the verification
        console.warn("Failed to update phone verification timestamp:", metadataErr.message);
      }
    }

    return NextResponse.json({
      userId: response.user_id,
      sessionToken: response.session_token,
      sessionJwt: response.session_jwt,
    });
  } catch (err: any) {
    console.error("Stytch OTP verification failed:", err.message);
    return NextResponse.json({ error: err.message || "Invalid OTP code" }, { status: 400 });
  }
}
