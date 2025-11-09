"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";

import { StrategyCard } from "@/components/strategies/StrategyCard";
import { PremiumGuard } from "@/components/access/PremiumGuard";
import { VaultDeployModal } from "@/components/vaults/VaultDeployModal";
import { useBaseUsdcReserve } from "@/hooks/useBaseUsdcReserve";
import { useKalaniApr } from "@/hooks/useKalaniApr";
import { formatPercent, formatUsd } from "@/lib/formatters";
import { KALANI_VAULT_ADDRESSES } from "@/lib/config/kalani";
import { useMembership } from "@/context/MembershipContext";

export default function StrategiesPage() {
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const { address } = useAccount();
  const membership = useMembership();

  const baseReserve = useBaseUsdcReserve();
  const kalani = useKalaniApr();

  const baseApr = baseReserve.loading
    ? "Loading..."
    : formatPercent(baseReserve.reserve?.supplyInfo.apy?.formatted);
  const baseTvl = baseReserve.loading ? "Loading..." : formatUsd(baseReserve.reserve?.size.usd);

  const kalaniAprDisplay = kalani.loading
    ? "Loading..."
    : kalani.apr !== undefined
      ? formatPercent(kalani.apr, "Pending oracle update")
      : "Pending oracle update";

  const kalaniFootnote = useMemo(
    () => (
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-slate-900">Key Contracts</span>
        <ul className="list-disc pl-4 text-xs text-slate-500">
          <li>
            Role Manager Factory:{" "}
            <Link
              href={`https://basescan.org/address/${KALANI_VAULT_ADDRESSES.roleManagerFactory}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {KALANI_VAULT_ADDRESSES.roleManagerFactory}
            </Link>
          </li>
          <li>
            APR Oracle:{" "}
            <Link
              href={`https://basescan.org/address/${KALANI_VAULT_ADDRESSES.aprOracle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {KALANI_VAULT_ADDRESSES.aprOracle}
            </Link>
          </li>
          <li>
            Address Provider:{" "}
            <Link
              href={`https://basescan.org/address/${KALANI_VAULT_ADDRESSES.addressProvider}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {KALANI_VAULT_ADDRESSES.addressProvider}
            </Link>
          </li>
        </ul>
      </div>
    ),
    [],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Creative Bank DeFi Suite
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Deploy & Manage Programmatic Yield Strategies
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Launch an Aave Earn Vault backed by the Base USDC reserve and unlock our token-gated
            Kalani premium strategies for high-touch treasury automation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Connected wallet: {address ?? "Not connected"}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            Membership tier: {membership.isLoading ? "Checking..." : membership.tier ?? "None"}
          </span>
        </div>
      </header>

      {baseReserve.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load Aave market data: {baseReserve.error.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StrategyCard
          title="Aave USDC Earn Vault"
          subtitle="Deploy a branded ERC-4626 vault sourcing yield from the Base USDC reserve."
          apr={baseApr}
          tvl={baseTvl}
          description="Create an on-chain USDC vault with automated fee routing, transparent reporting, and direct integration to the Aave Base money market."
          actions={[
            {
              id: "deploy-vault",
              label: "Deploy Vault",
              ariaLabel: "Deploy Aave USDC vault",
              onClick: () => setDeployModalOpen(true),
            },
            {
              id: "view-reserve",
              label: "View Reserve",
              ariaLabel: "View USDC reserve on Aave",
              onClick: () =>
                window.open(
                  "https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3",
                  "_blank",
                  "noopener,noreferrer",
                ),
            },
          ]}
          footnote={
            <p>
              Yield powered by the Base Aave v3 USDC reserve. Deployments require a connected wallet
              with USDC balance for the initial seed.
            </p>
          }
        />

        <PremiumGuard requiredTier="Creative Brand">
          <StrategyCard
            title="Kalani Vault Automation"
            subtitle="Modular Yearn v3 vault deployed on Base with Unlock-gated membership."
            apr={kalaniAprDisplay}
            tvl="Coming soon"
            description="Automatically allocate treasury assets into Kalani strategies that orchestrate Yearn v3 vault modules, with bespoke role management for Creative Bank members."
            actions={[
              {
                id: "open-dashboard",
                label: "Open Role Manager",
                ariaLabel: "Open Kalani role manager factory",
                onClick: () =>
                  window.open(
                    `https://basescan.org/address/${KALANI_VAULT_ADDRESSES.roleManagerFactory}`,
                    "_blank",
                    "noopener,noreferrer",
                  ),
              },
              {
                id: "view-apr",
                label: "View APR Oracle",
                ariaLabel: "View Kalani APR oracle contract",
                onClick: () =>
                  window.open(
                    `https://basescan.org/address/${KALANI_VAULT_ADDRESSES.aprOracle}`,
                    "_blank",
                    "noopener,noreferrer",
                  ),
              },
            ]}
            footnote={kalaniFootnote}
          />
        </PremiumGuard>
      </div>

      <VaultDeployModal
        open={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        market={baseReserve.market}
        reserve={baseReserve.reserve}
      />
    </main>
  );
}

