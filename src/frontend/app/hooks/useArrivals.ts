import { useQuery } from "@tanstack/react-query";
import { fetchArrivals } from "../api/arrivals";

export const useStopArrivals = (
  stopId: string,
  reduced: boolean = false,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ["arrivals", stopId, reduced],
    queryFn: () => fetchArrivals(stopId, reduced),
    enabled: !!stopId && enabled,
    refetchInterval: 15000, // Refresh every 15 seconds
    retry: false, // Disable retries to see errors immediately
  });
};
