"use client";

import { useMemo } from "react";

import {
  MEMBERSHIP_LOCKS,
  type MembershipLock,
  type MembershipTier,
} from "@/lib/config/memberships";
import { appChain, isBaseMainnet } from "@/lib/wagmiConfig";
import { useMembership } from "@/context/MembershipContext";
import { formatDateMs } from "@/lib/formatters";

type UnlockPromptProps = {
  requiredTier: MembershipTier;
  currentTier?: MembershipTier | null;
};

const chainLabel = isBaseMainnet ? "Base" : "Base Sepolia";

function buildCheckoutUrl(lock: MembershipLock) {
  const params = new URLSearchParams({
    client: "creative-bank",
    lock: lock.address,
    network: String(appChain.id),
  });

  return `https://app.unlock-protocol.com/locks/${lock.address}/checkout?${params.toString()}`;
}

export function UnlockPrompt({ requiredTier, currentTier }: UnlockPromptProps) {
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

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Unlock Membership
        </p>
        <h3 className="text-xl font-semibold text-emerald-900">Premium Access Required</h3>
        <p className="text-sm text-emerald-800">
          Access to this strategy requires the <strong>{requiredTier}</strong> membership NFT on{" "}
          {chainLabel}. Mint a membership below to continue.
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
              className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-white/80 p-4 md:flex-row md:items-center"
            >
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-base font-semibold text-slate-900">{lock.tier}</span>
                <span className="text-xs text-slate-500">{lock.address}</span>
                {hasKey ? (
                  <span className="text-xs text-emerald-600">
                    Active key {expiresAt ? `until ${expiresAt}` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">No active key found</span>
                )}
              </div>
              <button
                type="button"
                className="w-full rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:border-emerald-800 hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 md:w-auto"
                tabIndex={0}
                aria-label={`Open Unlock checkout for ${lock.tier}`}
                onClick={() => {
                  window.open(buildCheckoutUrl(lock), "_blank", "noopener,noreferrer");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    window.open(buildCheckoutUrl(lock), "_blank", "noopener,noreferrer");
                  }
                }}
              >
                {hasKey ? "Manage Key" : "Mint Key"}
              </button>
            </div>
          );
        })}
      </div>

      {currentTier ? (
        <p className="text-xs text-emerald-700">
          Current tier: <strong>{currentTier}</strong>. Upgrade to {requiredTier} to unlock this
          feature.
        </p>
      ) : null}
    </section>
  );
}

