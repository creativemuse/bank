import { NextRequest, NextResponse } from "next/server";
import { getStytchClient } from "@/lib/stytch";

/**
 * Sends an OTP via email or SMS using the Stytch Node SDK.
 * Used for both auth login and Coinbase phone verification.
 */
export async function POST(request: NextRequest) {
  try {
    const { type, destination } = await request.json();

    if (!type || !destination) {
      return NextResponse.json(
        { error: "type ('email' or 'sms') and destination are required" },
        { status: 400 }
      );
    }

    const stytch = getStytchClient();

    if (type === "email") {
      const response = await stytch.otps.email.loginOrCreate({
        email: destination,
      });
      return NextResponse.json({ methodId: response.email_id });
    }

    if (type === "sms") {
      const response = await stytch.otps.sms.loginOrCreate({
        phone_number: destination,
      });
      return NextResponse.json({ methodId: response.phone_id });
    }

    return NextResponse.json({ error: "type must be 'email' or 'sms'" }, { status: 400 });
  } catch (err: any) {
    console.error("Stytch OTP send failed:", err.message);
    return NextResponse.json({ error: err.message || "Failed to send OTP" }, { status: 500 });
  }
}
