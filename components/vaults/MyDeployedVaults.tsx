"use client";

import { useState, useMemo, useCallback } from "react";
import { Address } from "viem";
import { DeployedVaultCard } from "./DeployedVaultCard";
import { USDC_ADDRESS_BASE } from "@/lib/config/yearn";

type DeployedVault = {
  address: Address;
  name?: string;
  transactionHash?: string;
};

export const MyDeployedVaults = () => {
  const [vaults, setVaults] = useState<DeployedVault[]>(() => {
    // Load from localStorage on mount
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("deployedVaults");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newVaultAddress, setNewVaultAddress] = useState("");
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultTxHash, setNewVaultTxHash] = useState("");

  const saveVaults = useCallback((newVaults: DeployedVault[]) => {
    setVaults(newVaults);
    if (typeof window !== "undefined") {
      localStorage.setItem("deployedVaults", JSON.stringify(newVaults));
    }
  }, []);

  const handleAddVault = useCallback(() => {
    if (!newVaultAddress || !newVaultAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert("Please enter a valid Ethereum address (0x followed by 40 hex characters)");
      return;
    }

    const vault: DeployedVault = {
      address: newVaultAddress.toLowerCase() as Address,
      name: newVaultName || undefined,
      transactionHash: newVaultTxHash || undefined,
    };

    // Check if vault already exists
    if (vaults.some((v) => v.address.toLowerCase() === vault.address.toLowerCase())) {
      alert("This vault is already added");
      return;
    }

    saveVaults([...vaults, vault]);
    setNewVaultAddress("");
    setNewVaultName("");
    setNewVaultTxHash("");
    setShowAddForm(false);
  }, [newVaultAddress, newVaultName, newVaultTxHash, vaults, saveVaults]);

  const handleRemoveVault = useCallback(
    (address: Address) => {
      if (confirm("Remove this vault from your list?")) {
        saveVaults(vaults.filter((v) => v.address.toLowerCase() !== address.toLowerCase()));
      }
    },
    [vaults, saveVaults],
  );

  if (vaults.length === 0 && !showAddForm) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/80 p-8 text-center">
        <p className="mb-4 text-sm font-medium text-slate-500">No deployed vaults yet</p>
        <p className="mb-4 text-xs text-slate-400">
          Deploy a vault using the "Deploy Vault" button above, or add an existing vault address
          manually.
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Add Vault Address
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">My Deployed Vaults</h2>
          <p className="mt-1 text-sm text-slate-600">
            View and interact with your deployed Aave USDC vaults
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Add Vault
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Deployed Vault</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Vault Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newVaultAddress}
                onChange={(e) => setNewVaultAddress(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Find this in your deployment transaction on Basescan (check "Internal Transactions"
                or event logs)
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Vault Name (Optional)
              </label>
              <input
                type="text"
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                placeholder="My Aave Vault"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Transaction Hash (Optional)
              </label>
              <input
                type="text"
                value={newVaultTxHash}
                onChange={(e) => setNewVaultTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddVault}
                className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Add Vault
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewVaultAddress("");
                  setNewVaultName("");
                  setNewVaultTxHash("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {vaults.map((vault) => (
          <div key={vault.address} className="relative">
            <DeployedVaultCard
              vaultAddress={vault.address}
              assetAddress={USDC_ADDRESS_BASE}
              assetSymbol="USDC"
              assetDecimals={6}
              name={vault.name}
              transactionHash={vault.transactionHash}
            />
            <button
              onClick={() => handleRemoveVault(vault.address)}
              className="absolute right-2 top-2 rounded-full bg-red-100 p-1.5 text-red-600 transition hover:bg-red-200"
              aria-label="Remove vault"
              title="Remove vault"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

