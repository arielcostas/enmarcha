import { useQuery } from "@tanstack/react-query";
import { fetchPlan } from "../api/planner";

export const usePlanQuery = (
  fromLat: number | undefined,
  fromLon: number | undefined,
  toLat: number | undefined,
  toLon: number | undefined,
  time?: Date,
  arriveBy: boolean = false,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [
      "plan",
      fromLat,
      fromLon,
      toLat,
      toLon,
      time?.toISOString(),
      arriveBy,
    ],
    queryFn: () =>
      fetchPlan(fromLat!, fromLon!, toLat!, toLon!, time, arriveBy),
    enabled: !!(fromLat && fromLon && toLat && toLon) && enabled,
    staleTime: 60000, // 1 minute
    retry: false,
  });
};
