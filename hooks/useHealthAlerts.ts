"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";

interface HealthAlert {
  id: string;
  alert_type: "warning" | "danger";
  previous_status: string | null;
  current_status: string;
  health_factor: number;
  message: string;
  created_at: string;
}

/**
 * Polls for unacknowledged health alerts every 60 seconds.
 * Returns alert data and an acknowledge function.
 */
export function useHealthAlerts() {
  const { wallet } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = wallet?.address;

  const { data, isLoading } = useQuery<{ alerts: HealthAlert[] }>({
    queryKey: ["health-alerts", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return { alerts: [] };
      const response = await fetch(
        `/api/alerts?wallet=${encodeURIComponent(walletAddress)}`,
      );
      if (!response.ok) return { alerts: [] };
      return response.json();
    },
    enabled: !!walletAddress,
    refetchInterval: 60_000, // Poll every 60 seconds
    refetchOnWindowFocus: true,
  });

  const acknowledge = useCallback(
    async (alertId: string) => {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      // Invalidate cache to refresh
      queryClient.invalidateQueries({
        queryKey: ["health-alerts", walletAddress],
      });
    },
    [walletAddress, queryClient],
  );

  const alerts = data?.alerts ?? [];
  const hasUnacknowledged = alerts.length > 0;

  return { alerts, hasUnacknowledged, acknowledge, isLoading };
}
