/**
 * Health factor status for Aave-style risk meter.
 * Thresholds: Danger < 1, Warning 1 to < 1.2, Safe >= 1.2 (or no borrows).
 */

export type HealthFactorStatus = "safe" | "warning" | "danger" | null;

export type HealthFactorStatusLabel = {
  status: HealthFactorStatus;
  label: string;
  ariaLabel: string;
};

const DANGER_THRESHOLD = 1;
const WARNING_THRESHOLD = 1.2;

/**
 * Maps health factor and optional borrow state to a status for the Risk Meter.
 * Returns null when there is no supply/borrow or no health factor (e.g. no borrows).
 */
export function getHealthFactorStatus(
  healthFactor: number | string | null | undefined,
  hasBorrows?: boolean,
): HealthFactorStatus {
  if (healthFactor == null || healthFactor === "" || healthFactor === Infinity) {
    return hasBorrows ? "safe" : null; // No borrows: no meter needed (caller may show "Safe" for supply-only).
  }
  const value = typeof healthFactor === "string" ? Number.parseFloat(healthFactor) : Number(healthFactor);
  if (Number.isNaN(value)) return null;
  if (value < DANGER_THRESHOLD) return "danger";
  if (value < WARNING_THRESHOLD) return "warning";
  return "safe";
}

/**
 * Returns status plus short label and aria-label for the Risk Meter UI.
 */
export function getHealthFactorStatusLabel(
  healthFactor: number | string | null | undefined,
  hasBorrows?: boolean,
): HealthFactorStatusLabel | null {
  const status = getHealthFactorStatus(healthFactor, hasBorrows);
  if (status === null) return null;
  const labels: Record<Exclude<HealthFactorStatus, null>, { label: string; ariaLabel: string }> = {
    safe: { label: "Safe", ariaLabel: "Your loan is healthy" },
    warning: { label: "Warning – consider repaying", ariaLabel: "Health factor is in warning range; consider repaying to reduce liquidation risk" },
    danger: { label: "Danger – at risk of liquidation", ariaLabel: "Health factor is below 1; you are at risk of liquidation" },
  };
  const { label, ariaLabel } = labels[status];
  return { status, label, ariaLabel };
}
