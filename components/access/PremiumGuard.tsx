"use client";

import { type ReactNode } from "react";

import { TIER_PRIORITY, type MembershipTier } from "@/lib/config/memberships";
import { useMembership } from "@/context/MembershipContext";
import { UnlockPrompt } from "@/components/unlock/UnlockPrompt";

type PremiumGuardProps = {
  requiredTier: MembershipTier;
  children: ReactNode;
};

/**
 * Gates content behind a minimum membership tier.
 * Uses TIER_PRIORITY to compare the user's tier against the required tier.
 * A Brand member (priority 3) can access Creator-gated content (priority 1).
 */
export function PremiumGuard({ requiredTier, children }: PremiumGuardProps) {
  const { tier, isLoading } = useMembership();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-600">
        <span className="animate-pulse text-slate-500">
          Checking membership access…
        </span>
      </section>
    );
  }

  const userPriority = tier ? TIER_PRIORITY[tier] : TIER_PRIORITY.None;
  const requiredPriority = TIER_PRIORITY[requiredTier];

  if (userPriority < requiredPriority) {
    return <UnlockPrompt currentTier={tier} />;
  }

  return <>{children}</>;
}
