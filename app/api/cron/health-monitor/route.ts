import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/cockroachdb";
import { batchGetUserAccountData } from "@/lib/aavePool";

/**
 * GET /api/cron/health-monitor
 * Safety-net cron (hourly fallback via Vercel Cron).
 * Checks all users with active borrows and updates health factor snapshots.
 * Catches anything the price-triggered Goldsky webhooks may have missed.
 */
export async function GET(request: NextRequest) {
  // Vercel Cron authentication
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.COCKROACHDB_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const pool = getPool();

    // Get all known wallet addresses
    const { rows: users } = await pool.query(
      `SELECT wallet_address FROM users WHERE wallet_address IS NOT NULL`
    );

    if (users.length === 0) {
      return NextResponse.json({ checked: 0, message: "No users to monitor" });
    }

    const addresses = users.map((u: any) => u.wallet_address);
    const accountData = await batchGetUserAccountData(addresses);

    let snapshotsCreated = 0;
    let alertsCreated = 0;

    for (const data of accountData) {
      if (!data.hasBorrows) continue;

      const walletLower = data.walletAddress.toLowerCase();

      // Store snapshot
      await pool.query(
        `INSERT INTO health_factor_snapshots
         (wallet_address, health_factor, status, total_collateral_base, total_debt_base)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          walletLower,
          data.healthFactor,
          data.status,
          data.totalCollateralBase.toString(),
          data.totalDebtBase.toString(),
        ]
      );
      snapshotsCreated++;

      // Update cached health factor on user record
      await pool.query(
        `UPDATE users SET last_health_factor = $1, updated_at = now()
         WHERE wallet_address = $2`,
        [data.healthFactor, walletLower]
      );

      // Detect threshold transitions
      const { rows: prevSnapshots } = await pool.query(
        `SELECT status FROM health_factor_snapshots
         WHERE wallet_address = $1
         ORDER BY created_at DESC LIMIT 1 OFFSET 1`,
        [walletLower]
      );

      const prevStatus = prevSnapshots[0]?.status || "safe";

      if (
        (prevStatus === "safe" && (data.status === "warning" || data.status === "danger")) ||
        (prevStatus === "warning" && data.status === "danger")
      ) {
        const message =
          data.status === "danger"
            ? `Health factor at ${data.healthFactor.toFixed(2)}. Liquidation risk is imminent. Top up collateral now.`
            : `Health factor at ${data.healthFactor.toFixed(2)}. Consider repaying debt to improve your position.`;

        await pool.query(
          `INSERT INTO health_alerts
           (wallet_address, alert_type, previous_status, current_status, health_factor, message, email_queued)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            walletLower,
            data.status,
            prevStatus,
            data.status,
            data.healthFactor,
            message,
            data.status === "danger",
          ]
        );
        alertsCreated++;
      }
    }

    return NextResponse.json({
      checked: accountData.length,
      withBorrows: snapshotsCreated,
      alertsCreated,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Health Monitor Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
