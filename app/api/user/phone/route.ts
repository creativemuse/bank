import { NextRequest, NextResponse } from "next/server";
import { requireAuthedWallet } from "@/lib/apiAuth";
import { getPool } from "@/lib/cockroachdb";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * POST /api/user/phone
 * Stores a verified phone number for Coinbase onramp warm-start.
 * Requires an authenticated Crossmint JWT.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthedWallet(request);
  if (!auth.ok) return auth.response;

  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
    }

    const normalized = phoneNumber.trim();
    if (!E164_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: "Phone number must be in E.164 format (e.g. +12025551234)" },
        { status: 400 }
      );
    }

    const verifiedAt = new Date().toISOString();
    const pool = getPool();

    await pool.query(
      `INSERT INTO users (crossmint_user_id, wallet_address, phone_number, phone_number_verified_at, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (crossmint_user_id) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         phone_number_verified_at = EXCLUDED.phone_number_verified_at,
         updated_at = now()`,
      [auth.session.userId, auth.session.walletAddress, normalized, verifiedAt]
    );

    return NextResponse.json({
      phoneNumber: normalized,
      phoneNumberVerifiedAt: verifiedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save phone number";
    console.error("[user/phone] POST failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
