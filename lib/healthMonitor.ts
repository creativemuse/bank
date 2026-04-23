import type { Pool } from "pg";
import type { UserAccountData } from "./aavePool";

export type HealthCheckResult = {
  snapshotsCreated: number;
  alertsCreated: number;
};

export type AlertSource = "cron" | "price-update";

/**
 * Persist snapshots, cached HF, and threshold-transition alerts for a batch
 * of wallets using at most 4 queries regardless of batch size. Replaces the
 * previous 3N-queries-per-wallet loop that would not scale past a few
 * hundred users with borrows.
 *
 * Only users with active borrows are processed.
 */
export async function processHealthCheck(
  pool: Pool,
  accountData: UserAccountData[],
  source: AlertSource = "cron"
): Promise<HealthCheckResult> {
  const withBorrows = accountData.filter((d) => d.hasBorrows && d.status != null);
  if (withBorrows.length === 0) {
    return { snapshotsCreated: 0, alertsCreated: 0 };
  }

  const wallets = withBorrows.map((d) => d.walletAddress.toLowerCase());

  // 1) Fetch each wallet's most recent prior snapshot status in one query.
  //    Runs BEFORE the insert below so we see the pre-update state.
  const { rows: prevRows } = await pool.query<{ wallet_address: string; status: string }>(
    `SELECT DISTINCT ON (wallet_address) wallet_address, status
     FROM health_factor_snapshots
     WHERE wallet_address = ANY($1::text[])
     ORDER BY wallet_address, created_at DESC`,
    [wallets]
  );
  const prevStatusByWallet = new Map(prevRows.map((r) => [r.wallet_address, r.status]));

  // 2) Multi-row INSERT of fresh snapshots.
  const snapshotValues: unknown[] = [];
  const snapshotPlaceholders: string[] = [];
  withBorrows.forEach((d, i) => {
    const b = i * 5;
    snapshotPlaceholders.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
    snapshotValues.push(
      d.walletAddress.toLowerCase(),
      d.healthFactor,
      d.status,
      d.totalCollateralBase.toString(),
      d.totalDebtBase.toString()
    );
  });
  await pool.query(
    `INSERT INTO health_factor_snapshots
     (wallet_address, health_factor, status, total_collateral_base, total_debt_base)
     VALUES ${snapshotPlaceholders.join(",")}`,
    snapshotValues
  );

  // 3) Single UPDATE ... FROM (VALUES ...) to refresh cached HF on every user.
  const updateValues: unknown[] = [];
  const updatePlaceholders: string[] = [];
  withBorrows.forEach((d, i) => {
    const b = i * 2;
    updatePlaceholders.push(`($${b + 1}::text, $${b + 2}::numeric)`);
    updateValues.push(d.walletAddress.toLowerCase(), d.healthFactor);
  });
  await pool.query(
    `UPDATE users SET last_health_factor = v.hf, updated_at = now()
     FROM (VALUES ${updatePlaceholders.join(",")}) AS v(wallet, hf)
     WHERE users.wallet_address = v.wallet`,
    updateValues
  );

  // 4) Build threshold-transition alerts and insert in one statement.
  const alertRows = withBorrows.flatMap((d) => {
    const wallet = d.walletAddress.toLowerCase();
    const prev = prevStatusByWallet.get(wallet) ?? "safe";
    const current = d.status as "safe" | "warning" | "danger";
    const worsened =
      (prev === "safe" && (current === "warning" || current === "danger")) ||
      (prev === "warning" && current === "danger");
    if (!worsened) return [];

    return [
      {
        wallet,
        current,
        prev,
        hf: d.healthFactor,
        message: buildAlertMessage(source, current, d.healthFactor),
        queueEmail: current === "danger",
      },
    ];
  });

  if (alertRows.length > 0) {
    const alertValues: unknown[] = [];
    const alertPlaceholders: string[] = [];
    alertRows.forEach((a, i) => {
      const b = i * 7;
      alertPlaceholders.push(
        `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`
      );
      alertValues.push(a.wallet, a.current, a.prev, a.current, a.hf, a.message, a.queueEmail);
    });
    await pool.query(
      `INSERT INTO health_alerts
       (wallet_address, alert_type, previous_status, current_status, health_factor, message, email_queued)
       VALUES ${alertPlaceholders.join(",")}`,
      alertValues
    );
  }

  return { snapshotsCreated: withBorrows.length, alertsCreated: alertRows.length };
}

function buildAlertMessage(
  source: AlertSource,
  status: "safe" | "warning" | "danger",
  hf: number
): string {
  const hfStr = hf.toFixed(2);
  if (source === "price-update") {
    return status === "danger"
      ? `Your health factor dropped to ${hfStr}. You are at risk of liquidation. Top up collateral immediately.`
      : `Your health factor dropped to ${hfStr}. Consider repaying debt to reduce liquidation risk.`;
  }
  return status === "danger"
    ? `Health factor at ${hfStr}. Liquidation risk is imminent. Top up collateral now.`
    : `Health factor at ${hfStr}. Consider repaying debt to improve your position.`;
}
