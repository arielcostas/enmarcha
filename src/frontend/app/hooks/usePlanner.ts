import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { type PlannerSearchResult, type RoutePlan } from "../data/PlannerApi";
import { usePlanQuery } from "./usePlanQuery";

const STORAGE_KEY = "planner_route_history";
const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

interface StoredRoute {
  timestamp: number;
  origin: PlannerSearchResult;
  destination: PlannerSearchResult;
  plan?: RoutePlan;
  searchTime?: Date;
  arriveBy?: boolean;
  selectedItineraryIndex?: number;
}

export function usePlanner(options: { autoLoad?: boolean } = {}) {
  const { autoLoad = true } = options;
  const [origin, setOrigin] = useState<PlannerSearchResult | null>(null);
  const [destination, setDestination] = useState<PlannerSearchResult | null>(
    null
  );
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<Date | null>(null);
  const [arriveBy, setArriveBy] = useState(false);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState<
    number | null
  >(null);
  const [history, setHistory] = useState<StoredRoute[]>([]);
  const queryClient = useQueryClient();

  const {
    data: queryPlan,
    isLoading: queryLoading,
    error: queryError,
    isFetching,
  } = usePlanQuery(
    origin?.lat,
    origin?.lon,
    destination?.lat,
    destination?.lon,
    searchTime ?? undefined,
    arriveBy,
    !!(origin && destination && searchTime)
  );

  // Sync query result to local state and storage
  useEffect(() => {
    if (queryPlan) {
      setPlan(queryPlan as any);

      if (origin && destination) {
        const toStore: StoredRoute = {
          timestamp: Date.now(),
          origin,
          destination,
          plan: queryPlan as any,
          searchTime: searchTime ?? new Date(),
          arriveBy,
          selectedItineraryIndex: selectedItineraryIndex ?? undefined,
        };

        setHistory((prev) => {
          const filtered = prev.filter(
            (r) =>
              !(
                r.origin.lat === origin.lat &&
                r.origin.lon === origin.lon &&
                r.destination.lat === destination.lat &&
                r.destination.lon === destination.lon
              )
          );
          const updated = [toStore, ...filtered].slice(0, 3);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [
    queryPlan,
    origin,
    destination,
    searchTime,
    arriveBy,
    selectedItineraryIndex,
  ]);

  // Load from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredRoute[] = JSON.parse(stored);
        const valid = data.filter((r) => Date.now() - r.timestamp < EXPIRY_MS);
        setHistory(valid);

        if (autoLoad && valid.length > 0) {
          const last = valid[0];
          if (last.plan) {
            queryClient.setQueryData(
              [
                "plan",
                last.origin.lat,
                last.origin.lon,
                last.destination.lat,
                last.destination.lon,
                last.searchTime
                  ? new Date(last.searchTime).toISOString()
                  : undefined,
                last.arriveBy ?? false,
              ],
              last.plan
            );
            setPlan(last.plan);
          }
          setOrigin(last.origin);
          setDestination(last.destination);
          setSearchTime(last.searchTime ? new Date(last.searchTime) : null);
          setArriveBy(last.arriveBy ?? false);
          setSelectedItineraryIndex(last.selectedItineraryIndex ?? null);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [autoLoad]);

  const searchRoute = async (
    from: PlannerSearchResult,
    to: PlannerSearchResult,
    time?: Date,
    arriveByParam: boolean = false
  ) => {
    setOrigin(from);
    setDestination(to);
    const finalTime = time ?? new Date();
    setSearchTime(finalTime);
    setArriveBy(arriveByParam);
    setSelectedItineraryIndex(null);

    // Save to history immediately so other pages can pick it up
    const toStore: StoredRoute = {
      timestamp: Date.now(),
      origin: from,
      destination: to,
      searchTime: finalTime,
      arriveBy: arriveByParam,
    };

    setHistory((prev) => {
      const filtered = prev.filter(
        (r) =>
          !(
            r.origin.lat === from.lat &&
            r.origin.lon === from.lon &&
            r.destination.lat === to.lat &&
            r.destination.lon === to.lon
          )
      );
      const updated = [toStore, ...filtered].slice(0, 3);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const loadRoute = (route: StoredRoute) => {
    if (route.plan) {
      queryClient.setQueryData(
        [
          "plan",
          route.origin.lat,
          route.origin.lon,
          route.destination.lat,
          route.destination.lon,
          route.searchTime
            ? new Date(route.searchTime).toISOString()
            : undefined,
          route.arriveBy ?? false,
        ],
        route.plan
      );
      setPlan(route.plan);
    }
    setOrigin(route.origin);
    setDestination(route.destination);
    setSearchTime(route.searchTime ? new Date(route.searchTime) : null);
    setArriveBy(route.arriveBy ?? false);
    setSelectedItineraryIndex(route.selectedItineraryIndex ?? null);

    // Move to top of history
    setHistory((prev) => {
      const filtered = prev.filter(
        (r) =>
          !(
            r.origin.lat === route.origin.lat &&
            r.origin.lon === route.origin.lon &&
            r.destination.lat === route.destination.lat &&
            r.destination.lon === route.destination.lon
          )
      );
      const updated = [{ ...route, timestamp: Date.now() }, ...filtered].slice(
        0,
        3
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearRoute = () => {
    setPlan(null);
    setOrigin(null);
    setDestination(null);
    setSearchTime(null);
    setArriveBy(false);
    setSelectedItineraryIndex(null);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const selectItinerary = useCallback((index: number) => {
    setSelectedItineraryIndex(index);

    // Update storage
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], selectedItineraryIndex: index };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deselectItinerary = useCallback(() => {
    setSelectedItineraryIndex(null);

    // Update storage
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], selectedItineraryIndex: undefined };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    origin,
    setOrigin,
    destination,
    setDestination,
    plan,
    loading: queryLoading || (isFetching && !plan),
    error: queryError ? "Failed to calculate route. Please try again." : null,
    searchTime,
    arriveBy,
    selectedItineraryIndex,
    history,
    searchRoute,
    loadRoute,
    clearRoute,
    selectItinerary,
    deselectItinerary,
  };
}
