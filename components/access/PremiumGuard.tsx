"use client";

import { type ReactNode } from "react";

import { MEMBERSHIP_LOCKS, type MembershipTier } from "@/lib/config/memberships";
import { useMembership } from "@/context/MembershipContext";
import { UnlockPrompt } from "@/components/unlock/UnlockPrompt";

const PRIORITY_TABLE = MEMBERSHIP_LOCKS.reduce<Record<MembershipTier, number>>((acc, lock) => {
  acc[lock.tier] = lock.priority;
  return acc;
}, {
  "Creative Brand": 3,
  "Creative Investor": 2,
  "Creative Creator": 1,
});

type PremiumGuardProps = {
  requiredTier: MembershipTier;
  children: ReactNode;
};

export function PremiumGuard({ requiredTier, children }: PremiumGuardProps) {
  const membership = useMembership();

  if (membership.isLoading) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-600">
        <span className="animate-pulse text-slate-500">Checking membership access…</span>
      </section>
    );
  }

  const hasAnyValidMembership = MEMBERSHIP_LOCKS.some((lock) => {
    const state = membership.locks[lock.tier];
    return Boolean(state?.hasValidKey);
  });

  if (!hasAnyValidMembership) {
    return <UnlockPrompt />;
  }

  return <>{children}</>;
}

