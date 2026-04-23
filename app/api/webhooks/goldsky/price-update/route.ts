import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getPool } from "@/lib/cockroachdb";
import { batchGetUserAccountData } from "@/lib/aavePool";
import { getHealthFactorStatus } from "@/lib/healthFactor";

/**
 * POST /api/webhooks/goldsky/price-update
 * Goldsky price-triggered webhook. On significant price movements,
 * checks at-risk users and creates health factor alerts.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify Goldsky signature
  const signature = request.headers.get("x-goldsky-signature");
  const secret = process.env.GOLDSKY_WEBHOOK_SECRET;

  if (secret && signature) {
    const computed = createHmac("sha256", secret).update(body).digest("hex");
    try {
      if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(computed, "hex"))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(body);
    const asset = payload.asset || payload.symbol || payload.token;

    if (!process.env.COCKROACHDB_URL) {
      return NextResponse.json({ received: true, skipped: "no database" });
    }

    const pool = getPool();

    // Log the webhook event
    const eventId = payload.id || `price-${asset}-${Date.now()}`;
    await pool.query(
      `INSERT INTO webhook_events (event_type, event_id, source, payload, status)
       VALUES ('price_update', $1, 'goldsky', $2, 'received')
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, JSON.stringify(payload)]
    );

    // Find at-risk users with recent HF < 1.5. We intentionally re-check ALL
    // at-risk users on every price update rather than filtering by asset —
    // populating a per-user asset list would require an extra RPC pass, and
    // at the 50-user LIMIT the broader check is still fast.
    const { rows: atRiskUsers } = await pool.query(
      `SELECT wallet_address FROM users
       WHERE last_health_factor IS NOT NULL
         AND last_health_factor < 1.5
       LIMIT 50`
    );

    if (atRiskUsers.length === 0) {
      return NextResponse.json({ received: true, atRisk: 0 });
    }

    // Batch check health factors on-chain
    const addresses = atRiskUsers.map((r: any) => r.wallet_address);
    const accountData = await batchGetUserAccountData(addresses);

    let alertsCreated = 0;

    for (const data of accountData) {
      if (!data.hasBorrows) continue;

      // Store snapshot
      await pool.query(
        `INSERT INTO health_factor_snapshots
         (wallet_address, health_factor, status, total_collateral_base, total_debt_base)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          data.walletAddress.toLowerCase(),
          data.healthFactor,
          data.status,
          data.totalCollateralBase.toString(),
          data.totalDebtBase.toString(),
        ]
      );

      // Update user's cached health factor
      await pool.query(
        `UPDATE users SET last_health_factor = $1, updated_at = now()
         WHERE wallet_address = $2`,
        [data.healthFactor, data.walletAddress.toLowerCase()]
      );

      // Check for threshold breach — get previous status
      const { rows: prevSnapshots } = await pool.query(
        `SELECT status FROM health_factor_snapshots
         WHERE wallet_address = $1
         ORDER BY created_at DESC LIMIT 1 OFFSET 1`,
        [data.walletAddress.toLowerCase()]
      );

      const prevStatus = prevSnapshots[0]?.status || "safe";

      // Create alert if status worsened
      if (
        (prevStatus === "safe" && (data.status === "warning" || data.status === "danger")) ||
        (prevStatus === "warning" && data.status === "danger")
      ) {
        const message =
          data.status === "danger"
            ? `Your health factor dropped to ${data.healthFactor.toFixed(2)}. You are at risk of liquidation. Top up collateral immediately.`
            : `Your health factor dropped to ${data.healthFactor.toFixed(2)}. Consider repaying debt to reduce liquidation risk.`;

        await pool.query(
          `INSERT INTO health_alerts
           (wallet_address, alert_type, previous_status, current_status, health_factor, message, email_queued)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            data.walletAddress.toLowerCase(),
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
      received: true,
      atRisk: atRiskUsers.length,
      checked: accountData.length,
      alertsCreated,
    });
  } catch (err: any) {
    console.error("[Goldsky Price Webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
