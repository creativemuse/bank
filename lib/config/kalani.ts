import { Address } from "viem";

/**
 * Kalani Vault Deployment - Creative Bank on Base
 * 
 * Project ID: 0xb549b5f4ad020a1591e9c449c758d5d1e6f0b84d62b3aa133a98be87f2b51a9b
 * Deployed: Yearn V3 compatible multi-strategy vault
 */

export const KALANI_VAULT_ADDRESSES = {
  // Factory and Infrastructure
  roleManagerFactory: "0xca12459a931643BF28388c67639b3F352fe9e5Ce" as Address,
  aprOracle: "0x1981AD9F44F2EA9aDd2dC4AD7D075c102C70aF92" as Address,
  addressProvider: "0x1e9778aAD41Aa3E0884C276fB4C2D03C4036Aa0B" as Address,
  
  // Creative Bank USDC Vault (cbUSDC)
  creativeBankVault: "0xec8C6e90e8e84A368cbF2c2fd13DdF67884Ec5EE" as Address,
  roleManager: "0xAE31C2098a42aAB31b447876E4DAa649c16A307b" as Address,
  registry: "0x2aC025aE91dddcda3BB7D8EaB11efA3608dAF634" as Address,
  accountant: "0x928a31A7727e53CBE9f99fAb39eFb705c933093e" as Address,
  debtAllocator: "0xD1803ECCb53645D5bde0AE2FB1b55a2254fe358e" as Address,
} as const;

export const KALANI_CHAIN_ID = 8453;

/**
 * Creative Bank Vault Details
 */
export const CREATIVE_BANK_VAULT = {
  address: "0xec8C6e90e8e84A368cbF2c2fd13DdF67884Ec5EE" as Address,
  name: "USDC Creative Bank",
  symbol: "cbUSDC",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address, // USDC
  assetName: "USD Coin",
  assetSymbol: "USDC",
  type: "Creative Bank Allocator", // Yearn V3 multi-strategy
} as const;

