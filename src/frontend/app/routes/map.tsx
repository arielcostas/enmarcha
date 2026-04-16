import { Check, MapPin, Navigation, Search, X } from "lucide-react";
import type { FilterSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { useNavigate } from "react-router";
import { useApp } from "~/AppContext";
import {
  StopSummarySheet,
  type StopSheetProps,
} from "~/components/map/StopSummarySheet";
import { AppMap } from "~/components/shared/AppMap";
import { usePageTitle } from "~/contexts/PageTitleContext";
import {
  reverseGeocode,
  searchPlaces,
  type PlannerSearchResult,
} from "~/data/PlannerApi";
import { usePlanner } from "~/hooks/usePlanner";
import StopDataProvider from "../data/StopDataProvider";
import "../tailwind-full.css";
import "./map.css";

// Module-level: keeps search query + results alive across SPA navigation
const mapSearchState: { query: string; results: PlannerSearchResult[] } = {
  query: "",
  results: [],
};

const FEED_LABELS: Record<string, string> = {
  vitrasa: "Vitrasa",
  tussa: "Tussa",
  tranvias: "Tranvías",
  ourense: "TUORTE",
  lugo: "AUCORSA",
  xunta: "Xunta",
  renfe: "Renfe",
};

interface MapSearchBarProps {
  mapRef: React.RefObject<MapRef | null>;
}

function MapSearchBar({ mapRef }: MapSearchBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(mapSearchState.query);
  const [results, setResults] = useState<PlannerSearchResult[]>(
    mapSearchState.results
  );
  const [showResults, setShowResults] = useState(
    mapSearchState.results.length > 0
  );
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking/tapping outside the search container
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    mapSearchState.query = q;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      // Hide stale results when the query is cleared or too short
      setResults([]);
      mapSearchState.results = [];
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const center = mapRef.current?.getCenter();
        const res = await searchPlaces(q.trim(), center?.lat, center?.lng);
        setResults(res);
        mapSearchState.results = res;
        setShowResults(true);
      } catch {
        // keep old results on network error
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (place: PlannerSearchResult) => {
    const map = mapRef.current;
    if (map) {
      const zoom = place.layer === "stop" ? 17 : 16;
      map.flyTo({ center: [place.lon, place.lat], zoom, duration: 800 });
    }
    setShowResults(false);
    mapSearchState.results = [];
  };

  const handleClear = () => {
    setQuery("");
    mapSearchState.query = "";
    setResults([]);
    mapSearchState.results = [];
    setShowResults(false);
    inputRef.current?.focus();
  };

  return (
    <div className="absolute top-4 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
      <div
        ref={containerRef}
        className="pointer-events-auto w-full max-w-md flex flex-col gap-1"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 bg-white/95 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 py-3 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none"
            placeholder={t("map.search_placeholder", "Buscar un lugar…")}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowResults(true);
              // Re-trigger search if we have a query but results were cleared
              if (results.length === 0 && query.trim().length >= 2) {
                handleQueryChange(query);
              }
            }}
          />
          {loading ? (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin shrink-0" />
          ) : query ? (
            <button
              onPointerDown={(e) => {
                // Prevent input blur before clear fires
                e.preventDefault();
                handleClear();
              }}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label={t("planner.clear", "Clear")}
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Results dropdown */}
        {showResults && results.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((place, i) => {
                const isStop = place.layer === "stop";
                const feedId = place.stopId?.split(":")[0];
                const feedLabel = feedId ? (FEED_LABELS[feedId] ?? feedId) : undefined;
                const subtitle = isStop && feedLabel && place.stopCode
                  ? `${feedLabel} · ${place.stopCode}`
                  : isStop && feedLabel
                    ? feedLabel
                    : !isStop && place.label && place.label !== place.name
                      ? place.label
                      : null;
                return (
                  <button
                    key={`${place.lat}-${place.lon}-${i}`}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                    onClick={() => handleSelect(place)}
                  >
                    {isStop && place.color ? (
                      <span
                        className="shrink-0 mt-0.5 rounded-full"
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: place.color,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <MapPin className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {place.name}
                      </div>
                      {subtitle && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente principal del mapa
export default function StopMap() {
  const { t } = useTranslation();
  const {
    showBusStops: showCitybusStops,
    showCoachStops: showIntercityBusStops,
    showTrainStops,
  } = useApp();
  const navigate = useNavigate();
  usePageTitle(t("navbar.map", "Mapa"));
  const [selectedStop, setSelectedStop] = useState<
    StopSheetProps["stop"] | null
  >(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [disambiguationStops, setDisambiguationStops] = useState<
    Array<StopSheetProps["stop"] & { color?: string }>
  >([]);
  const mapRef = useRef<MapRef>(null);

  const {
    pickingMode,
    setPickingMode,
    setOrigin,
    setDestination,
    addRecentPlace,
  } = usePlanner({ autoLoad: false });

  const [isConfirming, setIsConfirming] = useState(false);

  // Context menu state (right-click / long-press)
  interface ContextMenuState {
    x: number;
    y: number;
    lat: number;
    lng: number;
  }
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [contextMenuLoading, setContextMenuLoading] = useState<
    "origin" | "destination" | null
  >(null);

  const handleContextMenu = (e: MapLayerMouseEvent) => {
    if (pickingMode) return;
    e.preventDefault?.();
    setContextMenu({
      x: e.point.x,
      y: e.point.y,
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleRouteFromHere = async () => {
    if (!contextMenu) return;
    setContextMenuLoading("origin");
    try {
      const result = await reverseGeocode(contextMenu.lat, contextMenu.lng);
      const place = {
        name:
          result?.name ||
          `${contextMenu.lat.toFixed(5)}, ${contextMenu.lng.toFixed(5)}`,
        label: result?.label || "Map location",
        lat: contextMenu.lat,
        lon: contextMenu.lng,
        layer: "map-pick",
      };
      setOrigin(place);
      addRecentPlace(place);
      closeContextMenu();
      navigate("/planner");
    } catch {
      closeContextMenu();
    } finally {
      setContextMenuLoading(null);
    }
  };

  const handleRouteToHere = async () => {
    if (!contextMenu) return;
    setContextMenuLoading("destination");
    try {
      const result = await reverseGeocode(contextMenu.lat, contextMenu.lng);
      const place = {
        name:
          result?.name ||
          `${contextMenu.lat.toFixed(5)}, ${contextMenu.lng.toFixed(5)}`,
        label: result?.label || "Map location",
        lat: contextMenu.lat,
        lon: contextMenu.lng,
        layer: "map-pick",
      };
      setDestination(place);
      addRecentPlace(place);
      closeContextMenu();
      navigate("/planner");
    } catch {
      closeContextMenu();
    } finally {
      setContextMenuLoading(null);
    }
  };

  const handleConfirmPick = async () => {
    if (!mapRef.current || !pickingMode) return;
    const center = mapRef.current.getCenter();
    setIsConfirming(true);

    try {
      const result = await reverseGeocode(center.lat, center.lng);
      const finalResult = {
        name:
          result?.name || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
        label: result?.label || "Map location",
        lat: center.lat,
        lon: center.lng,
        layer: "map-pick",
      };

      if (pickingMode === "origin") {
        setOrigin(finalResult);
      } else {
        setDestination(finalResult);
      }
      addRecentPlace(finalResult);
      setPickingMode(null);
      navigate("/planner");
    } catch (err) {
      console.error("Failed to reverse geocode:", err);
    } finally {
      setIsConfirming(false);
    }
  };

  const favouriteIds = useMemo(() => StopDataProvider.getFavouriteIds(), []);

  const favouriteFilter = useMemo(() => {
    if (favouriteIds.length === 0) return ["boolean", false];
    return ["match", ["get", "id"], favouriteIds, true, false];
  }, [favouriteIds]);

  // Handle click events on clusters and individual stops
  const onMapClick = (e: MapLayerMouseEvent) => {
    // Clicking anywhere on the map closes the disambiguation panel
    setDisambiguationStops([]);

    const features = e.features;
    if (!features || features.length === 0) {
      console.debug(
        "No features found on map click. Position:",
        e.lngLat,
        "Point:",
        e.point
      );
      return;
    }

    // Collect only stop-layer features with valid properties
    const stopFeatures = features.filter(
      (f) => f.layer?.id?.startsWith("stops") && f.properties?.id
    );

    if (stopFeatures.length === 0) return;

    if (stopFeatures.length === 1) {
      // Single unambiguous stop – open the sheet directly
      handlePointClick(stopFeatures[0]);
      return;
    }

    // Multiple overlapping stops – deduplicate by stop id and ask the user
    const seen = new Set<string>();
    const candidates: Array<StopSheetProps["stop"] & { color?: string }> = [];
    for (const f of stopFeatures) {
      const id: string = f.properties!.id;
      if (!seen.has(id)) {
        seen.add(id);
        candidates.push({
          stopId: id,
          stopCode: f.properties!.code,
          name: f.properties!.name || "Unknown Stop",
          color: f.properties!.color as string | undefined,
        });
      }
    }

    // For xunta stops, further deduplicate by base code (strip first 2 chars)
    // e.g. "xunta:1007958" and "xunta:2007958" → keep only the first seen
    const xuntaBaseSeen = new Set<string>();
    const deduped = candidates.filter((stop) => {
      if (!stop.stopId?.startsWith("xunta:")) return true;
      const code = stop.stopCode ?? "";
      const base = code.startsWith("xunta:") ? code.slice("xunta:".length + 2) : code.slice(2);
      if (xuntaBaseSeen.has(base)) return false;
      xuntaBaseSeen.add(base);
      return true;
    });

    if (deduped.length === 1) {
      // After deduplication only one stop remains
      setSelectedStop(deduped[0]);
      setIsSheetOpen(true);
    } else {
      setDisambiguationStops(deduped);
    }
  };

  const stopLayerFilter = useMemo(() => {
    const filter: any[] = ["any", ["==", ["get", "transitKind"], "unknown"]];
    if (showCitybusStops) {
      filter.push(["==", ["get", "transitKind"], "bus"]);
    }
    if (showIntercityBusStops) {
      filter.push(["==", ["get", "transitKind"], "coach"]);
    }
    if (showTrainStops) {
      filter.push(["==", ["get", "transitKind"], "train"]);
    }
    return filter as FilterSpecification;
  }, [showCitybusStops, showIntercityBusStops, showTrainStops]);

  const handlePointClick = (feature: any) => {
    const props: {
      id: string;
      code: string;
      name: string;
      routes: string;
    } = feature.properties;
    // TODO: Move ID to constant, improve type checking
    if (!props || feature.layer.id.startsWith("stops") === false) {
      console.warn("Invalid feature properties:", props);
      return;
    }

    setSelectedStop({
      stopId: props.id,
      stopCode: props.code,
      name: props.name || "Unknown Stop",
    });
    setIsSheetOpen(true);
  };

  return (
    <div className="relative h-full">
      {!pickingMode && <MapSearchBar mapRef={mapRef} />}

      {pickingMode && (
        <div className="absolute top-4 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
          <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md pointer-events-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                {pickingMode === "origin"
                  ? t("planner.pick_origin", "Select origin")
                  : t("planner.pick_destination", "Select destination")}
              </h3>
              <button
                onClick={() => setPickingMode(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {t(
                "planner.pick_instruction",
                "Move the map to place the target on the desired location"
              )}
            </p>
            <button
              onClick={handleConfirmPick}
              disabled={isConfirming}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isConfirming ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {t("planner.confirm_location", "Confirm location")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {pickingMode && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Modern discrete target */}
            <div className="w-1 h-1 bg-primary-600 rounded-full shadow-[0_0_0_4px_rgba(37,99,235,0.1)]" />
            <div className="absolute w-6 h-[1px] bg-primary-600/30" />
            <div className="absolute w-[1px] h-6 bg-primary-600/30" />
          </div>
        </div>
      )}

      <AppMap
        ref={mapRef}
        syncState={true}
        showNavigation={true}
        showGeolocate={true}
        showTraffic={pickingMode ? false : undefined}
        interactiveLayerIds={["stops", "stops-label"]}
        onClick={(e) => {
          closeContextMenu();
          onMapClick(e);
        }}
        onContextMenu={handleContextMenu}
        onDragStart={() => setDisambiguationStops([])}
        attributionControl={{ compact: false }}
      >
        <Source
          id="stops-source"
          type="vector"
          tiles={[StopDataProvider.getTileUrlTemplate()]}
          minzoom={11}
          maxzoom={20}
        />

        {!pickingMode && (
          <Layer
            id="stops-favourite-highlight"
            type="circle"
            minzoom={11}
            source="stops-source"
            source-layer="stops"
            filter={["all", stopLayerFilter, favouriteFilter]}
            paint={{
              "circle-color": "#FFD700",
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                13,
                10,
                16,
                12,
                18,
                16,
              ],
              "circle-opacity": 0.4,
              "circle-stroke-color": "#FFD700",
              "circle-stroke-width": 2,
            }}
          />
        )}

        <Layer
          id="stops"
          type="symbol"
          minzoom={11}
          source="stops-source"
          source-layer="stops"
          filter={stopLayerFilter}
          layout={{
            "icon-image": ["get", "icon"],
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              0.7,
              16,
              0.8,
              18,
              1.2,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-sort-key": [
              "match",
              ["get", "transitKind"],
              "bus",
              3,
              "train",
              2,
              "coach",
              1,
              0,
            ],
          }}
        />

        <Layer
          id="stops-label"
          type="symbol"
          source="stops-source"
          source-layer="stops"
          minzoom={16}
          filter={stopLayerFilter}
          layout={{
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Bold"],
            "text-offset": [0, 3],
            "text-anchor": "center",
            "text-justify": "center",
            "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 22, 17],
            "symbol-sort-key": [
              "match",
              ["get", "transitKind"],
              "bus",
              3,
              "train",
              2,
              "coach",
              1,
              0,
            ],
            "text-allow-overlap": false,
          }}
          paint={{
            "text-color": [
              "match",
              ["get", "feed"],
              "vitrasa",
              "#81D002",
              "tussa",
              "#508096",
              "tranvias",
              "#E61C29",
              "ourense",
              "#ffb319",
              "lugo",
              "#FDC609",
              "xunta",
              "#007BC4",
              "renfe",
              "#870164",
              "#27187D",
            ],
            "text-halo-color": [
              "match",
              ["get", "feed"],
              "ourense",
              "#000000",
              "lugo",
              "#000000",
              "#FFF",
            ],
            "text-halo-width": [
              "match",
              ["get", "feed"],
              "ourense",
              1.5,
              "lugo",
              1.5,
              1,
            ],
          }}
        />

        {selectedStop && (
          <StopSummarySheet
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            stop={selectedStop}
          />
        )}

        {disambiguationStops.length > 1 && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none pb-safe">
            <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  {t("map.select_nearby_stop", "Seleccionar parada")}
                </h3>
                <button
                  onClick={() => setDisambiguationStops([])}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label={t("planner.close", "Cerrar")}
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {disambiguationStops.map((stop) => (
                  <li key={stop.stopId}>
                    <button
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-lg px-2"
                      onClick={() => {
                        setDisambiguationStops([]);
                        setSelectedStop(stop);
                        setIsSheetOpen(true);
                      }}
                    >
                      {stop.color ? (
                        <span
                          className="rounded-full shrink-0"
                          style={{
                            width: 18,
                            height: 18,
                            backgroundColor: stop.color,
                            display: "inline-block",
                          }}
                        />
                      ) : (
                        <MapPin className="w-4 h-4 shrink-0 text-primary-600" />
                      )}
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          {stop.name}
                        </div>
                        {stop.stopCode && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {stop.stopCode}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </AppMap>

      {contextMenu && (
        <>
          {/* Dismiss backdrop */}
          <div className="absolute inset-0 z-30" onClick={closeContextMenu} />
          {/* Context menu */}
          <div
            className="absolute z-40 min-w-[180px] rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 120),
            }}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              onClick={handleRouteFromHere}
              disabled={contextMenuLoading !== null}
            >
              {contextMenuLoading === "origin" ? (
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Navigation className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
              )}
              <span className="font-medium">
                {t("map.route_from_here", "Ruta desde aquí")}
              </span>
            </button>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              onClick={handleRouteToHere}
              disabled={contextMenuLoading !== null}
            >
              {contextMenuLoading === "destination" ? (
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <MapPin className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
              )}
              <span className="font-medium">
                {t("map.route_to_here", "Ruta hasta aquí")}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
