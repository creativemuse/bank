"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { MembershipProvider } from "@/context/MembershipContext";
import { CrossmintWalletWithPasskey } from "@/components/auth/CrossmintWalletWithPasskey";

type ValidChain = "base" | "base-sepolia";

type AppShellProps = {
  chain: ValidChain;
  children: ReactNode;
};

/**
 * OAuth/magic-link callback must not wait on wallet passkey probing.
 * Membership and Crossmint wallet providers are skipped on `/authenticate`.
 */
export const AppShell = ({ chain, children }: AppShellProps) => {
  const pathname = usePathname();

  if (pathname === "/authenticate") {
    return <>{children}</>;
  }

  return (
    <CrossmintWalletWithPasskey chain={chain}>
      <MembershipProvider>{children}</MembershipProvider>
    </CrossmintWalletWithPasskey>
  );
};
