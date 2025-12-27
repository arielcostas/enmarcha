import { useCallback, useEffect, useState } from "react";
import { type PlannerSearchResult, type RoutePlan } from "../data/PlannerApi";
import { usePlanQuery } from "./usePlanQuery";

const STORAGE_KEY = "planner_last_route";
const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

interface StoredRoute {
  timestamp: number;
  origin: PlannerSearchResult;
  destination: PlannerSearchResult;
  plan: RoutePlan;
  searchTime?: Date;
  arriveBy?: boolean;
  selectedItineraryIndex?: number;
}

export function usePlanner() {
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
    !!(origin && destination)
  );

  // Sync query result to local state and storage
  useEffect(() => {
    if (queryPlan) {
      setPlan(queryPlan as any); // Cast because of slight type differences if any, but they should match now

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
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
        const data: StoredRoute = JSON.parse(stored);
        if (Date.now() - data.timestamp < EXPIRY_MS) {
          setOrigin(data.origin);
          setDestination(data.destination);
          setPlan(data.plan);
          setSearchTime(data.searchTime ? new Date(data.searchTime) : null);
          setArriveBy(data.arriveBy ?? false);
          setSelectedItineraryIndex(data.selectedItineraryIndex ?? null);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const searchRoute = async (
    from: PlannerSearchResult,
    to: PlannerSearchResult,
    time?: Date,
    arriveByParam: boolean = false
  ) => {
    setOrigin(from);
    setDestination(to);
    setSearchTime(time ?? new Date());
    setArriveBy(arriveByParam);
    setSelectedItineraryIndex(null);
  };

  const clearRoute = () => {
    setPlan(null);
    setOrigin(null);
    setDestination(null);
    setSearchTime(null);
    setArriveBy(false);
    setSelectedItineraryIndex(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const selectItinerary = useCallback((index: number) => {
    setSelectedItineraryIndex(index);

    // Update storage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredRoute = JSON.parse(stored);
        data.selectedItineraryIndex = index;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        // Ignore
      }
    }
  }, []);

  const deselectItinerary = useCallback(() => {
    setSelectedItineraryIndex(null);

    // Update storage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredRoute = JSON.parse(stored);
        data.selectedItineraryIndex = undefined;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        // Ignore
      }
    }
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
    searchRoute,
    clearRoute,
    selectItinerary,
    deselectItinerary,
  };
}
