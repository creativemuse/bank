const DEFAULT_UNLOCK_CLIENT_ID = "creative-bank";
const DEFAULT_UNLOCK_CHAIN_ID = 8453;

const configuredChainId = Number(process.env.NEXT_PUBLIC_UNLOCK_CHAIN_ID ?? DEFAULT_UNLOCK_CHAIN_ID);

const resolveChainLabel = (chainId: number) => {
  if (chainId === 8453) {
    return "Base";
  }

  if (chainId === 84532) {
    return "Base Sepolia";
  }

  return `Chain ${chainId}`;
};

export const unlockClientId =
  process.env.NEXT_PUBLIC_UNLOCK_CLIENT_ID ?? DEFAULT_UNLOCK_CLIENT_ID;

export const unlockChainId = Number.isNaN(configuredChainId)
  ? DEFAULT_UNLOCK_CHAIN_ID
  : configuredChainId;

export const unlockChainLabel = resolveChainLabel(unlockChainId);

