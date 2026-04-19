import { useWallet } from "@crossmint/client-sdk-react-ui";
import { useQuery } from "@tanstack/react-query";

export function useActivityFeed() {
  const { wallet } = useWallet();
  return useQuery({
    queryKey: ["walletActivity", wallet?.address],
    queryFn: async () => {
      const response = await wallet?.transfers({ status: "successful" });
      return {
        events: (response?.data ?? []).map((t) => ({
          from_address: t.sender.address,
          to_address: t.recipient.address,
          transaction_hash: t.onChain?.txId ?? "",
          timestamp: t.completedAt,
          amount: t.token.amount,
          token_symbol: t.token.symbol,
        })),
      };
    },
    enabled: !!wallet?.address,
    refetchOnMount: true,
  });
}
