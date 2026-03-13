import { useQuery } from "@tanstack/react-query";
import { fetchArrivals, fetchEstimates } from "../api/arrivals";

export const useStopArrivals = (
  stopId: string,
  reduced: boolean = false,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ["arrivals", stopId, reduced],
    queryFn: () => fetchArrivals(stopId, reduced),
    enabled: !!stopId && enabled,
    refetchInterval: 15000,
    retry: false,
  });
};

export const useStopEstimates = (
  stopId: string,
  routeId: string,
  viaStopId?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ["estimates", stopId, routeId, viaStopId],
    queryFn: () => fetchEstimates(stopId, routeId, viaStopId),
    enabled: !!stopId && !!routeId && enabled,
    refetchInterval: 15000,
    retry: false,
  });
};
