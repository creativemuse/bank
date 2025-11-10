"use client";

import { useMemo } from "react";

import {
  MEMBERSHIP_LOCKS,
  type MembershipTier,
} from "@/lib/config/memberships";
import { unlockChainLabel } from "@/lib/config/unlock";
import { useMembership } from "@/context/MembershipContext";
import { formatDateMs } from "@/lib/formatters";

// Unlock checkout configuration URL with all three Creative membership locks
const UNLOCK_CHECKOUT_URL = "https://app.unlock-protocol.com/checkout?id=fce0c0fb-2c39-4912-807f-e5f64a9276e0";

const formatLockAddress = (address: string) => {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

type UnlockPromptProps = {
  currentTier?: MembershipTier | null;
};

export function UnlockPrompt({ currentTier }: UnlockPromptProps) {
  const membership = useMembership();

  const sortedLocks = useMemo(
    () =>
      [...MEMBERSHIP_LOCKS].sort((a, b) => {
        if (a.priority === b.priority) {
          return a.tier.localeCompare(b.tier);
        }
        return b.priority - a.priority;
      }),
    [],
  );

  const hasAnyKey = sortedLocks.some((lock) => membership.locks[lock.tier]?.hasValidKey);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Creative Membership
        </p>
        <h3 className="text-xl font-semibold text-emerald-900">Premium Access Required</h3>
        <p className="text-sm text-emerald-800">
          Access to this strategy requires a Creative membership NFT on {unlockChainLabel}. Choose from
          three membership tiers to unlock premium features.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {sortedLocks.map((lock) => {
          const state = membership.locks[lock.tier];
          const hasKey = Boolean(state?.hasValidKey);
          const expiresAt = state?.expiresAtMs ? formatDateMs(state.expiresAtMs) : null;

          return (
            <div
              key={lock.address}
              className="flex flex-col justify-between gap-2 rounded-xl border border-emerald-200 bg-white/80 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-base font-semibold text-slate-900">{lock.tier}</span>
                  <span
                    className="text-xs text-slate-500"
                    title={lock.address}
                    aria-label={`Membership contract address ${lock.address}`}
                  >
                    {formatLockAddress(lock.address)}
                  </span>
                </div>
                {hasKey && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                )}
              </div>
              {hasKey && expiresAt && (
                <span className="text-xs text-emerald-600">Valid until {expiresAt}</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="w-full rounded-lg border border-emerald-700 bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition hover:border-emerald-800 hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        tabIndex={0}
        aria-label="Open Creative membership checkout"
        onClick={() => {
          window.open(UNLOCK_CHECKOUT_URL, "_blank", "noopener,noreferrer");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            window.open(UNLOCK_CHECKOUT_URL, "_blank", "noopener,noreferrer");
          }
        }}
      >
        {hasAnyKey ? "Manage Membership" : "Get Creative Membership"}
      </button>

      {currentTier && (
        <p className="text-xs text-emerald-700">
          Current tier: <strong>{currentTier}</strong>. Maintain an active membership to retain
          access.
        </p>
      )}
    </section>
  );
}

