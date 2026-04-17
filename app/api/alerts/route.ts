import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/cockroachdb";

/**
 * GET /api/alerts?wallet=0x...
 * Returns unacknowledged health alerts for a wallet address.
 *
 * PATCH /api/alerts
 * Acknowledges an alert by ID.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "wallet parameter is required" }, { status: 400 });
  }

  if (!process.env.COCKROACHDB_URL) {
    return NextResponse.json({ alerts: [] });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, alert_type, previous_status, current_status,
              health_factor, message, created_at
       FROM health_alerts
       WHERE wallet_address = $1 AND acknowledged = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [wallet.toLowerCase()]
    );

    return NextResponse.json({ alerts: rows });
  } catch (err: any) {
    console.error("[Alerts API] Error:", err.message);
    return NextResponse.json({ alerts: [] });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { alertId } = await request.json();

    if (!alertId) {
      return NextResponse.json({ error: "alertId is required" }, { status: 400 });
    }

    if (!process.env.COCKROACHDB_URL) {
      return NextResponse.json({ acknowledged: true });
    }

    const pool = getPool();
    await pool.query(
      `UPDATE health_alerts
       SET acknowledged = true, acknowledged_at = now()
       WHERE id = $1`,
      [alertId]
    );

    return NextResponse.json({ acknowledged: true });
  } catch (err: any) {
    console.error("[Alerts API] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
