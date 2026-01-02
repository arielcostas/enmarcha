import { ChevronUp, Map, MapPin } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import PlaceListItem from "~/components/PlaceListItem";
import {
  reverseGeocode,
  searchPlaces,
  type PlannerSearchResult,
} from "~/data/PlannerApi";
import StopDataProvider from "~/data/StopDataProvider";
import { usePlanner } from "~/hooks/usePlanner";

interface PlannerOverlayProps {
  onSearch: (
    origin: PlannerSearchResult,
    destination: PlannerSearchResult,
    time?: Date,
    arriveBy?: boolean
  ) => void;
  onNavigateToPlanner?: () => void;
  forceExpanded?: boolean;
  inline?: boolean;
  clearPickerOnOpen?: boolean;
  showLastDestinationWhenCollapsed?: boolean;
  cardBackground?: string;
  userLocation?: { latitude: number; longitude: number } | null;
  autoLoad?: boolean;
}

export const PlannerOverlay: React.FC<PlannerOverlayProps> = ({
  onSearch,
  onNavigateToPlanner,
  forceExpanded,
  inline,
  clearPickerOnOpen = false,
  showLastDestinationWhenCollapsed = true,
  cardBackground,
  userLocation,
  autoLoad = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    origin,
    setOrigin,
    destination,
    setDestination,
    loading,
    error,
    setPickingMode,
    isExpanded,
    setIsExpanded,
    recentPlaces,
    addRecentPlace,
    clearRecentPlaces,
  } = usePlanner({ autoLoad });
  const [originQuery, setOriginQuery] = useState(origin?.name || "");
  const [destQuery, setDestQuery] = useState("");

  type PickerField = "origin" | "destination";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField>("destination");
  const [pickerQuery, setPickerQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<PlannerSearchResult[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const [favouriteStops, setFavouriteStops] = useState<PlannerSearchResult[]>(
    []
  );

  const pickerInputRef = useRef<HTMLInputElement | null>(null);

  const [locationLoading, setLocationLoading] = useState(false);
  const [timeMode, setTimeMode] = useState<"now" | "depart" | "arrive">("now");
  const [timeValue, setTimeValue] = useState("");
  const [dateOffset, setDateOffset] = useState(0); // 0 = today, 1 = tomorrow, etc.

  const canSubmit = useMemo(
    () => Boolean(origin && destination) && !loading,
    [origin, destination, loading]
  );

  useEffect(() => {
    setOriginQuery(
      origin?.layer === "current-location"
        ? t("planner.current_location")
        : origin?.name || ""
    );
  }, [origin, t]);

  useEffect(() => {
    if (userLocation && !origin) {
      const initial: PlannerSearchResult = {
        name: t("planner.current_location"),
        label: "GPS",
        lat: userLocation.latitude,
        lon: userLocation.longitude,
        layer: "current-location",
      };
      setOrigin(initial);
      setOriginQuery(initial.name || "");
    }
  }, [userLocation, origin, t, setOrigin]);

  useEffect(() => {
    setDestQuery(destination?.name || "");
  }, [destination]);

  useEffect(() => {
    // Load favourites once; used as local suggestions in the picker.
    const favouriteIds = StopDataProvider.getFavouriteIds();
    StopDataProvider.fetchStopsByIds(favouriteIds)
      .then((stopsMap) =>
        Object.values(stopsMap)
          .filter((s) => s.latitude && s.longitude)
          .map(
            (s) =>
              ({
                name: StopDataProvider.getDisplayName(s),
                label: s.stopId,
                lat: s.latitude as number,
                lon: s.longitude as number,
                layer: "favourite-stop",
              }) satisfies PlannerSearchResult
          )
      )
      .then((mapped) => setFavouriteStops(mapped))
      .catch(() => setFavouriteStops([]));
  }, []);

  const filteredFavouriteStops = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return favouriteStops;
    return favouriteStops.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.label || "").toLowerCase().includes(q)
    );
  }, [favouriteStops, pickerQuery]);

  const sortedRemoteResults = useMemo(() => {
    const order: Record<string, number> = { venue: 0, address: 1, street: 2 };

    return remoteResults;
  }, [remoteResults, pickerQuery]);

  const openPicker = (field: PickerField) => {
    setPickerField(field);
    setPickerQuery(
      clearPickerOnOpen ? "" : field === "origin" ? originQuery : destQuery
    );
    setPickerOpen(true);
  };

  const applyPickedResult = (result: PlannerSearchResult) => {
    if (pickerField === "origin") {
      setOrigin(result);
      setOriginQuery(result.name || "");
    } else {
      setDestination(result);
      setDestQuery(result.name || "");
    }
    addRecentPlace(result);
    setPickerOpen(false);
  };

  const setOriginFromCurrentLocation = useCallback(
    (closePicker: boolean = true) => {
      console.log(
        "[PlannerOverlay] setOriginFromCurrentLocation called, closePicker:",
        closePicker
      );
      if (!navigator.geolocation) {
        console.warn("[PlannerOverlay] Geolocation not available");
        return;
      }
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          console.log(
            "[PlannerOverlay] Geolocation success:",
            pos.coords.latitude,
            pos.coords.longitude
          );
          try {
            // Set immediately using raw coordinates; refine later if reverse geocode works.
            const initial: PlannerSearchResult = {
              name: t("planner.current_location"),
              label: "GPS",
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              layer: "current-location",
            };
            console.log("[PlannerOverlay] Setting initial origin:", initial);
            setOrigin(initial);
            setOriginQuery(initial.name || "");

            try {
              const rev = await reverseGeocode(
                pos.coords.latitude,
                pos.coords.longitude
              );
              console.log("[PlannerOverlay] Reverse geocode result:", rev);
              if (rev) {
                const refined: PlannerSearchResult = {
                  ...initial,
                  name: rev.name || initial.name,
                  label: rev.label || initial.label,
                  layer: "current-location",
                };
                console.log(
                  "[PlannerOverlay] Setting refined origin:",
                  refined
                );
                setOrigin(refined);
                setOriginQuery(refined.name || "");
              }
            } catch (err) {
              console.error("[PlannerOverlay] Reverse geocode failed:", err);
            }

            if (closePicker) setPickerOpen(false);
          } finally {
            setLocationLoading(false);
          }
        },
        (err) => {
          console.error("[PlannerOverlay] Geolocation error:", err);
          setLocationLoading(false);
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      );
    },
    [setOrigin, t]
  );

  useEffect(() => {
    if (!pickerOpen) return;
    // Focus the modal input on open.
    const t = setTimeout(() => pickerInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const q = pickerQuery.trim();
    if (q.length < 3) {
      setRemoteResults([]);
      setRemoteLoading(false);
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await searchPlaces(q);
        if (!cancelled) setRemoteResults(results);
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pickerOpen, pickerQuery]);

  // Allow external triggers (e.g., map movements) to collapse the widget, unless forced expanded
  useEffect(() => {
    if (forceExpanded) return;
    const handler = () => setIsExpanded(false);
    window.addEventListener("plannerOverlay:collapse", handler);
    return () => window.removeEventListener("plannerOverlay:collapse", handler);
  }, [forceExpanded]);

  // Derive expanded state
  const expanded = forceExpanded ?? isExpanded;

  const wrapperClass = inline
    ? "w-full"
    : "pointer-events-none absolute left-0 right-0 top-0 z-20 flex justify-center mb-3";

  const cardClass = inline
    ? `pointer-events-auto w-full overflow-hidden rounded-xl px-2 flex flex-col gap-4 ${cardBackground || "bg-white dark:bg-slate-900"} mb-3`
    : `pointer-events-auto w-[min(640px,calc(100%-16px))] px-2 py-1 flex flex-col gap-4 m-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/70 shadow-2xl backdrop-blur ${cardBackground || "bg-white/95 dark:bg-slate-900/90"} mb-3`;

  return (
    <div className={wrapperClass}>
      <div className={cardClass}>
        {!expanded ? (
          <button
            type="button"
            className="block w-full px-2 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
            onClick={() => {
              setIsExpanded(true);
            }}
          >
            <div className="text-small font-semibold text-slate-900 dark:text-slate-100">
              {showLastDestinationWhenCollapsed && destQuery
                ? destQuery
                : t("planner.where_to")}
            </div>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="grow rounded-lg bg-surface border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150 focus:outline-none focus:border-primary-500 shadow-sm"
                onClick={() => openPicker("origin")}
              >
                <span
                  className={
                    originQuery ? "" : "text-slate-500 dark:text-slate-400"
                  }
                >
                  {originQuery || t("planner.origin")}
                </span>
              </button>
              {!forceExpanded && (
                <button
                  type="button"
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  onClick={() => setIsExpanded(false)}
                  aria-label={t("planner.collapse", "Collapse")}
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              )}
            </div>

            <div>
              <button
                type="button"
                className="w-full rounded-lg bg-surface border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150 focus:outline-none focus:border-primary-500 shadow-sm"
                onClick={() => openPicker("destination")}
              >
                <span
                  className={
                    destQuery ? "" : "text-slate-500 dark:text-slate-400"
                  }
                >
                  {destQuery || t("planner.destination")}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">{t("planner.when")}</span>
              <div className="flex gap-1 rounded-2xl bg-surface border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                    timeMode === "now"
                      ? "bg-primary-500 text-white shadow-sm"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setTimeMode("now")}
                >
                  {t("planner.now")}
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                    timeMode === "depart"
                      ? "bg-primary-500 text-white shadow-sm"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setTimeMode("depart")}
                >
                  {t("planner.depart_at")}
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                    timeMode === "arrive"
                      ? "bg-primary-500 text-white shadow-sm"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => setTimeMode("arrive")}
                >
                  {t("planner.arrive_by")}
                </button>
              </div>
              {timeMode !== "now" && (
                <div className="flex gap-2 w-full">
                  <select
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-surface px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary-500 grow shadow-sm"
                    value={dateOffset}
                    onChange={(e) => setDateOffset(Number(e.target.value))}
                  >
                    {Array.from({ length: 7 }, (_, i) => {
                      const date = new Date();
                      date.setDate(date.getDate() + i);
                      const label =
                        i === 0
                          ? "Hoy"
                          : i === 1
                            ? "Mañana"
                            : date.toLocaleDateString("es-ES", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              });
                      return (
                        <option key={i} value={i}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="time"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-surface px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary-500 grow shadow-sm"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <button
                className="w-full rounded-xl bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 px-2 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none"
                disabled={!canSubmit}
                onClick={async () => {
                  if (origin && destination) {
                    let time: Date | undefined;
                    if (timeMode === "now") {
                      // For SERP, reflect the actual generation time
                      time = new Date();
                    } else if (timeValue) {
                      const targetDate = new Date();
                      targetDate.setDate(targetDate.getDate() + dateOffset);
                      const [hours, minutes] = timeValue.split(":").map(Number);
                      targetDate.setHours(hours, minutes, 0, 0);
                      time = targetDate;
                    }

                    await onSearch(
                      origin,
                      destination,
                      time,
                      timeMode === "arrive"
                    );

                    // After search, if origin was current location, switch to reverse-geocoded address
                    if (
                      origin.layer === "current-location" &&
                      origin.lat &&
                      origin.lon
                    ) {
                      try {
                        const rev = await reverseGeocode(
                          origin.lat,
                          origin.lon
                        );
                        const updated = {
                          ...origin,
                          name: rev?.name || origin.name,
                          label: rev?.label || origin.label,
                          layer: "geocoded-location",
                        } as PlannerSearchResult;
                        setOrigin(updated);
                      } catch {
                        // ignore reverse geocode errors
                      }
                    }

                    onNavigateToPlanner?.();
                  }
                }}
                type="button"
              >
                {loading ? t("planner.searching") : t("planner.search_route")}
              </button>
            </div>

            {error && (
              <div className="mx-3 mb-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {pickerOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex justify-center items-start p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            aria-label={t("planner.close")}
            onClick={() => setPickerOpen(false)}
          />

          <div className="relative w-[min(640px,calc(100%-12px))] overflow-hidden rounded-lg bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/80">
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {pickerField === "origin"
                  ? t("planner.select_origin")
                  : t("planner.select_destination")}
              </div>
            </div>

            <div className="p-4">
              <div className="relative">
                <input
                  ref={pickerInputRef}
                  className="w-full pr-12 px-4 py-3 text-base border border-slate-200 dark:border-slate-700 rounded-2xl bg-surface text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-primary-500 shadow-sm transition-all duration-200"
                  placeholder={
                    pickerField === "origin"
                      ? t("planner.search_origin")
                      : t("planner.search_destination")
                  }
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={t("planner.clear")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold"
                  onClick={() => {
                    if (pickerQuery) {
                      setPickerQuery("");
                    } else {
                      setPickerOpen(false);
                    }
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <ul className="max-h-[70vh] overflow-auto list-none m-0 p-0">
              {pickerField === "origin" && (
                <li className="border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors duration-200"
                    onClick={() => setOriginFromCurrentLocation}
                    disabled={locationLoading}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-4 h-4">
                        <MapPin className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {t("planner.current_location")}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {t("planner.gps")}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg text-slate-600 dark:text-slate-400">
                      {locationLoading ? "…" : ""}
                    </div>
                  </button>
                </li>
              )}

              <li className="border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
                  onClick={() => {
                    setPickingMode(pickerField);
                    setPickerOpen(false);
                    navigate("/map");
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4">
                      <Map className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t("planner.pick_on_map", "Pick on map")}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t(
                          "planner.pick_on_map_desc",
                          "Select a point visually"
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>

              {(remoteLoading || sortedRemoteResults.length > 0) && (
                <li className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70">
                  {remoteLoading
                    ? t("planner.searching_ellipsis")
                    : t("planner.results", "Results")}
                </li>
              )}

              {sortedRemoteResults.map((r, i) => (
                <PlaceListItem
                  key={`remote-${i}`}
                  place={r}
                  onClick={applyPickedResult}
                />
              ))}

              {filteredFavouriteStops.length > 0 && (
                <>
                  <li className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70">
                    {t("planner.favourite_stops")}
                  </li>
                  {filteredFavouriteStops.map((r, i) => (
                    <PlaceListItem
                      key={`fav-${i}`}
                      place={r}
                      onClick={applyPickedResult}
                    />
                  ))}
                </>
              )}

              {recentPlaces.length > 0 && (
                <li className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between">
                  <span>
                    {t("planner.recent_locations", "Recent locations")}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                    onClick={clearRecentPlaces}
                  >
                    {t("planner.clear")}
                  </button>
                </li>
              )}
              {recentPlaces.map((r, i) => (
                <li
                  key={`recent-${i}`}
                  className="border-t border-slate-100 dark:border-slate-700"
                >
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200"
                    onClick={() => applyPickedResult(r)}
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {r.name}
                    </div>
                    {r.label && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {r.label}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
