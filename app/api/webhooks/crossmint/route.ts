import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getPool } from "@/lib/cockroachdb";

/**
 * POST /api/webhooks/crossmint
 * Handles Crossmint wallet events (wallet.created, transaction.completed, etc.)
 * Verifies signature using HMAC-SHA256.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-crossmint-signature");
  const timestamp = request.headers.get("x-crossmint-timestamp");
  const secret = process.env.CROSSMINT_WEBHOOK_SECRET;

  // Verify signature
  if (secret && signature && timestamp) {
    // Strip whsec_ prefix if present (Stripe-like format)
    const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const payload = `${timestamp}.${body}`;
    const computed = createHmac("sha256", key).update(payload).digest("hex");

    try {
      if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(computed, "hex"))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      // If comparison fails (different lengths, etc.), reject
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Replay protection: reject if timestamp is > 5 minutes old
    const timestampMs = Number(timestamp) * 1000;
    if (Date.now() - timestampMs > 5 * 60 * 1000) {
      return NextResponse.json({ error: "Timestamp too old" }, { status: 401 });
    }
  }

  try {
    const event = JSON.parse(body);
    const eventType = event.type || event.event || "unknown";
    const eventId = event.id || event.event_id || `crossmint-${Date.now()}`;

    // Extract wallet address from event data
    const walletAddress =
      event.data?.walletAddress || event.data?.wallet?.address || event.data?.address || null;

    if (!process.env.COCKROACHDB_URL) {
      return NextResponse.json({ received: true });
    }

    const pool = getPool();

    // Log event to audit trail
    await pool.query(
      `INSERT INTO webhook_events (event_type, event_id, source, payload, wallet_address, status)
       VALUES ($1, $2, 'crossmint', $3, $4, 'processed')
       ON CONFLICT (event_id) DO NOTHING`,
      [eventType, eventId, JSON.stringify(event), walletAddress?.toLowerCase()]
    );

    console.log(`[Crossmint Webhook] ${eventType} for ${walletAddress || "unknown"}`);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Crossmint Webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
