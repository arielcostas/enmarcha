import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { type PlannerSearchResult, type RoutePlan } from "../data/PlannerApi";
import { usePlanQuery } from "../hooks/usePlanQuery";

const STORAGE_KEY = "planner_route_history";
const RECENT_KEY = "recentPlaces";
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

export type PickingMode = "origin" | "destination" | null;

interface PlannerContextType {
  origin: PlannerSearchResult | null;
  setOrigin: (origin: PlannerSearchResult | null) => void;
  destination: PlannerSearchResult | null;
  setDestination: (destination: PlannerSearchResult | null) => void;
  plan: RoutePlan | null;
  loading: boolean;
  error: string | null;
  searchTime: Date | null;
  setSearchTime: (time: Date | null) => void;
  arriveBy: boolean;
  setArriveBy: (arriveBy: boolean) => void;
  selectedItineraryIndex: number | null;
  history: StoredRoute[];
  recentPlaces: PlannerSearchResult[];
  addRecentPlace: (place: PlannerSearchResult) => void;
  clearRecentPlaces: () => void;
  pickingMode: PickingMode;
  setPickingMode: (mode: PickingMode) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  searchRoute: (
    from: PlannerSearchResult,
    to: PlannerSearchResult,
    time?: Date,
    arriveByParam?: boolean
  ) => Promise<void>;
  loadRoute: (route: StoredRoute) => void;
  clearRoute: () => void;
  selectItinerary: (index: number) => void;
  deselectItinerary: () => void;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export const PlannerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [origin, setOriginInternal] = useState<PlannerSearchResult | null>(
    null
  );
  const [destination, setDestinationInternal] =
    useState<PlannerSearchResult | null>(null);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [searchTime, setSearchTimeInternal] = useState<Date | null>(null);
  const [arriveBy, setArriveByInternal] = useState(false);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState<
    number | null
  >(null);
  const [history, setHistory] = useState<StoredRoute[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<PlannerSearchResult[]>([]);
  const [pickingMode, setPickingMode] = useState<PickingMode>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);

  const setOrigin = useCallback((p: PlannerSearchResult | null) => {
    setOriginInternal(p);
    setSearchTriggered(false);
  }, []);

  const setDestination = useCallback((p: PlannerSearchResult | null) => {
    setDestinationInternal(p);
    setSearchTriggered(false);
  }, []);

  const setSearchTime = useCallback((t: Date | null) => {
    setSearchTimeInternal(t);
    setSearchTriggered(false);
  }, []);

  const setArriveBy = useCallback((a: boolean) => {
    setArriveByInternal(a);
    setSearchTriggered(false);
  }, []);

  const queryClient = useQueryClient();

  // Load recent places from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PlannerSearchResult[];
        setRecentPlaces(parsed.slice(0, 20));
      }
    } catch {
      setRecentPlaces([]);
    }
  }, []);

  const addRecentPlace = useCallback((p: PlannerSearchResult) => {
    setRecentPlaces((prev) => {
      const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
      const existing = prev.filter(
        (rp) => `${rp.lat.toFixed(5)},${rp.lon.toFixed(5)}` !== key
      );
      const updated = [
        {
          name: p.name,
          label: p.label,
          lat: p.lat,
          lon: p.lon,
          layer: p.layer,
        },
        ...existing,
      ].slice(0, 20);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const clearRecentPlaces = useCallback(() => {
    setRecentPlaces([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
  }, []);

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
    searchTriggered && !!(origin && destination && searchTime)
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

        if (valid.length > 0) {
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
          setOriginInternal(last.origin);
          setDestinationInternal(last.destination);
          setSearchTimeInternal(
            last.searchTime ? new Date(last.searchTime) : null
          );
          setArriveByInternal(last.arriveBy ?? false);
          setSelectedItineraryIndex(last.selectedItineraryIndex ?? null);
          setSearchTriggered(true);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [queryClient]);

  const searchRoute = async (
    from: PlannerSearchResult,
    to: PlannerSearchResult,
    time?: Date,
    arriveByParam: boolean = false
  ) => {
    setOriginInternal(from);
    setDestinationInternal(to);
    const finalTime = time ?? new Date();
    setSearchTimeInternal(finalTime);
    setArriveByInternal(arriveByParam);
    setSelectedItineraryIndex(null);
    setSearchTriggered(true);

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

  const loadRoute = useCallback(
    (route: StoredRoute) => {
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
      setOriginInternal(route.origin);
      setDestinationInternal(route.destination);
      setSearchTimeInternal(
        route.searchTime ? new Date(route.searchTime) : null
      );
      setArriveByInternal(route.arriveBy ?? false);
      setSelectedItineraryIndex(route.selectedItineraryIndex ?? null);
      setSearchTriggered(true);

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
        const updated = [
          { ...route, timestamp: Date.now() },
          ...filtered,
        ].slice(0, 3);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [queryClient]
  );

  const clearRoute = useCallback(() => {
    setPlan(null);
    setOriginInternal(null);
    setDestinationInternal(null);
    setSearchTimeInternal(null);
    setArriveByInternal(false);
    setSelectedItineraryIndex(null);
    setSearchTriggered(false);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const selectItinerary = useCallback((index: number) => {
    setSelectedItineraryIndex(index);
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
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[0] = { ...updated[0], selectedItineraryIndex: undefined };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <PlannerContext.Provider
      value={{
        origin,
        setOrigin,
        destination,
        setDestination,
        plan,
        loading: queryLoading || (isFetching && !plan),
        error: queryError
          ? "Failed to calculate route. Please try again."
          : null,
        searchTime,
        setSearchTime,
        arriveBy,
        setArriveBy,
        selectedItineraryIndex,
        history,
        recentPlaces,
        addRecentPlace,
        clearRecentPlaces,
        pickingMode,
        setPickingMode,
        isExpanded,
        setIsExpanded,
        searchRoute,
        loadRoute,
        clearRoute,
        selectItinerary,
        deselectItinerary,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
};

export const usePlannerContext = () => {
  const context = useContext(PlannerContext);
  if (context === undefined) {
    throw new Error("usePlannerContext must be used within a PlannerProvider");
  }
  return context;
};
