import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bus,
  ChevronDown,
  Clock,
  LayoutGrid,
  List,
  Map as MapIcon,
  Star,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AttributionControl,
  Layer,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { fetchRouteDetails } from "~/api/transit";
import { AppMap } from "~/components/shared/AppMap";
import {
  useBackButton,
  usePageRightNode,
  usePageTitle,
  usePageTitleNode,
} from "~/contexts/PageTitleContext";
import { useStopEstimates } from "~/hooks/useArrivals";
import { useFavorites } from "~/hooks/useFavorites";
import { formatHex } from "~/utils/colours";
import "../tailwind-full.css";

function FavoriteStar({ id }: { id?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites("favouriteRoutes");
  const { t } = useTranslation();

  if (!id) return null;

  const isFav = isFavorite(id);

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(id)}
      className="p-2 rounded-full hover:bg-surface"
      aria-label={t("routes.toggle_favorite", "Alternar favorita")}
    >
      <Star
        size={20}
        className={isFav ? "fill-yellow-500 text-yellow-500" : "text-muted"}
      />
    </button>
  );
}

export default function RouteDetailsPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPatternId = location.hash ? location.hash.slice(1) : null;
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"balanced" | "map" | "list">(
    "balanced"
  );
  const [isPatternPickerOpen, setIsPatternPickerOpen] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(
    () => new Date()
  );
  const mapRef = useRef<MapRef>(null);
  const stopRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { isFavorite, toggleFavorite } = useFavorites("favouriteRoutes");

  const formatDateKey = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const selectedDateKey = useMemo(
    () => formatDateKey(selectedWeekDate),
    [selectedWeekDate]
  );
  const ONE_HOUR_SECONDS = 3600;
  const isTodaySelectedDate = selectedDateKey === formatDateKey(new Date());
  const now = new Date();
  const nowSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const formatDelayMinutes = (delayMinutes: number) => {
    if (delayMinutes === 0) return "OK";
    return delayMinutes > 0
      ? ` (R${Math.abs(delayMinutes)})`
      : ` (A${Math.abs(delayMinutes)})`;
  };

  const { data: route, isLoading } = useQuery({
    queryKey: ["route", id, selectedDateKey],
    queryFn: () => fetchRouteDetails(id!, selectedDateKey),
    enabled: !!id,
  });
  const { data: selectedStopEstimates, isLoading: isRealtimeLoading } =
    useStopEstimates(
      selectedStopId ?? "",
      id ?? "",
      undefined,
      Boolean(selectedStopId) && Boolean(id) && isTodaySelectedDate
    );

  usePageTitle(
    route?.shortName
      ? `${route.shortName} - ${route.longName}`
      : t("routes.details", "Detalles de ruta")
  );

  const titleNode = useMemo(() => {
    if (!route) {
      return (
        <span className="text-base font-semibold text-text">
          {t("routes.details", "Detalles de ruta")}
        </span>
      );
    }

    return (
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-lg font-bold leading-none"
            style={{
              color: route.color ? formatHex(route.color) : "var(--text-color)",
            }}
          >
            {route.shortName || route.longName}
          </span>
          <span className="text-sm text-text/90 truncate text-wrap tracking-tight leading-none">
            {route.longName}
          </span>
        </div>
      </div>
    );
  }, [route, t]);

  usePageTitleNode(titleNode);

  const rightNode = useMemo(() => <FavoriteStar id={id} />, [id]);
  usePageRightNode(rightNode);

  const backTo =
    (location.state as { backTo?: string } | null)?.backTo ?? "/routes";
  useBackButton({ to: backTo });

  const weekDays = useMemo(() => {
    const base = new Date();
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const date = new Date(base);
      date.setDate(base.getDate() + offset);

      let label: string;
      if (offset === -1) {
        label = t("routes.day_yesterday", "Ayer");
      } else if (offset === 0) {
        label = t("routes.day_today", "Hoy");
      } else if (offset === 1) {
        label = t("routes.day_tomorrow", "Mañana");
      } else {
        label = date.toLocaleDateString(i18n.language || "es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      }

      return {
        key: formatDateKey(date),
        date,
        label,
      };
    });
  }, [i18n.language, t]);

  const activePatterns = useMemo(() => {
    return route?.patterns.filter((p) => p.tripCount > 0) ?? [];
  }, [route?.patterns]);

  const patternsByDirection = useMemo(() => {
    return activePatterns.reduce(
      (acc, pattern) => {
        const dir = pattern.directionId;
        if (!acc[dir]) acc[dir] = [];
        acc[dir].push(pattern);
        return acc;
      },
      {} as Record<number, typeof route.patterns>
    );
  }, [activePatterns, route?.patterns]);

  const selectedPattern = useMemo(() => {
    if (!route) return null;

    if (selectedPatternId) {
      const found = activePatterns.find((p) => p.id === selectedPatternId);
      if (found) return found;
    }

    // Try to find the most frequent pattern in direction 0 (outbound)
    const outboundPatterns = (patternsByDirection[0] ?? []).sort(
      (a, b) => b.tripCount - a.tripCount
    );
    if (outboundPatterns.length > 0) return outboundPatterns[0];

    // Fallback to any pattern with trips
    const anyPatterns = [...activePatterns].sort(
      (a, b) => b.tripCount - a.tripCount
    );
    return anyPatterns[0] || route.patterns[0];
  }, [activePatterns, patternsByDirection, selectedPatternId, route]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-4">{t("routes.not_found", "Línea no encontrada")}</div>
    );
  }

  const selectedPatternLabel = selectedPattern
    ? selectedPattern.headsign || selectedPattern.name
    : t("routes.details", "Detalles de ruta");
  const sameDirectionPatterns = selectedPattern
    ? (patternsByDirection[selectedPattern.directionId] ?? [])
    : [];
  const departuresByStop = (() => {
    const byStop = new Map<
      string,
      { departure: number; patternId: string; tripId?: string | null }[]
    >();

    if (selectedPattern?.tripCount === 0) {
      return byStop;
    }

    for (const pattern of sameDirectionPatterns) {
      for (const stop of pattern.stops) {
        const current = byStop.get(stop.id) ?? [];
        current.push(
          ...stop.scheduledDepartures.map((departure) => ({
            departure,
            patternId: pattern.id,
            tripId: null,
          }))
        );
        byStop.set(stop.id, current);
      }
    }

    for (const stopDepartures of byStop.values()) {
      stopDepartures.sort((a, b) => a.departure - b.departure);
    }

    return byStop;
  })();

  const mapHeightClass =
    layoutMode === "map"
      ? "h-[75%] md:h-[75%]"
      : layoutMode === "list"
        ? "h-[25%] md:h-[25%]"
        : "h-[50%] md:h-[50%]";

  const layoutOptions = [
    {
      id: "map",
      label: t("routes.layout_map", "Mapa"),
      icon: MapIcon,
    },
    {
      id: "balanced",
      label: t("routes.layout_balanced", "Equilibrada"),
      icon: LayoutGrid,
    },
    {
      id: "list",
      label: t("routes.layout_list", "Paradas"),
      icon: List,
    },
  ] as const;

  const handleStopClick = (
    stopId: string,
    lat: number,
    lon: number,
    scroll = true
  ) => {
    setSelectedStopId(stopId);
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom: 15,
      duration: 1000,
    });

    if (scroll) {
      stopRefs.current[stopId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: selectedPattern?.geometry
      ? [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: selectedPattern.geometry,
            },
            properties: {},
          },
        ]
      : [],
  };

  const stopsGeojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features:
      selectedPattern?.stops.map((stop) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [stop.lon, stop.lat],
        },
        properties: {
          id: stop.id,
          name: stop.name,
          code: stop.code,
          lat: stop.lat,
          lon: stop.lon,
        },
      })) || [],
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className={`${mapHeightClass} relative`}>
            <AppMap
              ref={mapRef}
              initialViewState={
                selectedPattern?.stops[0]
                  ? {
                      latitude: selectedPattern.stops[0].lat,
                      longitude: selectedPattern.stops[0].lon,
                      zoom: 13,
                    }
                  : undefined
              }
              interactiveLayerIds={["stop-circles"]}
              onClick={(e) => {
                const feature = e.features?.[0];
                if (feature && feature.layer.id === "stop-circles") {
                  const { id, lat, lon } = feature.properties;
                  handleStopClick(id, lat, lon, true);
                }
              }}
              showTraffic={false}
              attributionControl={false}
            >
              <AttributionControl position="bottom-left" compact={true} />
              {selectedPattern?.geometry && (
                <Source type="geojson" data={geojson}>
                  <Layer
                    id="route-line-border"
                    type="line"
                    paint={{
                      "line-color":
                        route.textColor && route.textColor.trim()
                          ? formatHex(route.textColor)
                          : "#111827",
                      "line-width": 7,
                      "line-opacity": 0.75,
                    }}
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                  />
                  <Layer
                    id="route-line-inner"
                    type="line"
                    paint={{
                      "line-color": route.color
                        ? formatHex(route.color)
                        : "#3b82f6",
                      "line-width": 5,
                    }}
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                  />
                </Source>
              )}
              <Source type="geojson" data={stopsGeojson}>
                <Layer
                  id="stop-circles"
                  type="circle"
                  paint={{
                    "circle-radius": 6,
                    "circle-color": [
                      "case",
                      ["==", ["get", "id"], selectedStopId ?? ""],
                      route.color ? formatHex(route.color) : "#3b82f6",
                      "#ffffff",
                    ],
                    "circle-stroke-width": 2,
                    "circle-stroke-color": [
                      "case",
                      ["==", ["get", "id"], selectedStopId ?? ""],
                      "#ffffff",
                      route.color ? formatHex(route.color) : "#3b82f6",
                    ],
                  }}
                />
              </Source>
            </AppMap>

            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
              {layoutOptions.map((option) => {
                const Icon = option.icon;
                const isActive = layoutMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setLayoutMode(option.id)}
                    className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-muted hover:text-text"
                    }`}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-3 py-2 bg-surface border-y border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPatternPickerOpen(true)}
                className="w-full flex-2 px-3 py-1.5 text-left box-border bg-surface text-text text-sm rounded-md border border-border hover:border-primary/60 focus:ring-2 focus:ring-primary outline-none"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {selectedPatternLabel}
                  </span>
                  {selectedPattern?.tripCount != null && (
                    <span className="text-xs text-muted">
                      {t("routes.trip_count_short", {
                        count: selectedPattern.tripCount,
                      })}
                    </span>
                  )}
                  <ChevronDown size={16} className="ml-auto text-muted" />
                </div>
              </button>

              <select
                className="w-full px-3 py-1.5 box-border bg-surface text-text focus:ring-2 focus:ring-primary outline-none text-sm rounded-md border border-border flex-1"
                value={selectedDateKey}
                onChange={(e) => {
                  const next = weekDays.find(
                    (day) => day.key === e.target.value
                  );
                  if (next) {
                    setSelectedWeekDate(next.date);
                  }
                }}
                aria-label={t("routes.week_date", "Fecha")}
              >
                {weekDays.map((day) => (
                  <option key={day.key} value={day.key}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isPatternPickerOpen && (
            <div
              className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/40"
              onClick={() => setIsPatternPickerOpen(false)}
            >
              <div
                className="w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[80%] overflow-hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {t("routes.trips", "Trayectos")}
                    </p>
                    <p className="text-xs text-muted">
                      {t("routes.choose_trip", "Elige un trayecto")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPatternPickerOpen(false)}
                    className="p-2 rounded-full hover:bg-surface"
                    aria-label={t("routes.close", "Cerrar")}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="overflow-y-auto max-h-[60vh] pb-3">
                  {[0, 1].map((dir) => {
                    const patterns = patternsByDirection[dir] ?? [];
                    if (patterns.length === 0) return null;
                    const directionLabel =
                      dir === 0
                        ? t("routes.direction_outbound", "Ida")
                        : t("routes.direction_inbound", "Vuelta");
                    const sortedPatterns = [...patterns].sort(
                      (a, b) => b.tripCount - a.tripCount
                    );

                    return (
                      <div key={dir}>
                        <div className="px-4 my-2 text-xs font-semibold text-muted uppercase tracking-wide">
                          {directionLabel}
                        </div>
                        <div className="space-y-2 px-3 mb-3">
                          {sortedPatterns.map((pattern) => {
                            const destination =
                              pattern.headsign || pattern.name || "";
                            const firstStop = pattern.stops[0]?.name ?? "";
                            const lastStop =
                              pattern.stops[pattern.stops.length - 1]?.name ??
                              "";
                            const times =
                              pattern.stops[0]?.scheduledDepartures?.slice(
                                0,
                                3
                              ) ?? [];

                            return (
                              <button
                                key={pattern.id}
                                type="button"
                                onClick={() => {
                                  navigate(
                                    { hash: "#" + pattern.id },
                                    { replace: true }
                                  );
                                  setSelectedStopId(null);
                                  setIsPatternPickerOpen(false);
                                }}
                                className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                                  selectedPattern?.id === pattern.id
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-surface hover:border-primary/50"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-base font-semibold text-text truncate">
                                        {destination ||
                                          t("routes.trip", "Trayecto")}
                                      </p>
                                    </div>
                                    <p className="text-xs text-muted mt-1 truncate">
                                      {firstStop}
                                      {firstStop && lastStop ? " → " : ""}
                                      {lastStop}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted">
                                    {pattern.tripCount <= 3 &&
                                    times.length > 0 ? (
                                      <div className="flex items-center gap-1">
                                        <Clock size={14} />
                                        <span>
                                          {times
                                            .map((dep) => {
                                              const h = Math.floor(dep / 3600)
                                                .toString()
                                                .padStart(2, "0");
                                              const m = Math.floor(
                                                (dep % 3600) / 60
                                              )
                                                .toString()
                                                .padStart(2, "0");
                                              return `${h}:${m}`;
                                            })
                                            .join(" · ")}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <Bus size={14} />
                                        <span>
                                          {t("routes.trip_count_short", {
                                            count: pattern.tripCount,
                                          })}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-3 bg-background">
            <h3 className="text-base font-semibold mb-3 text-text">
              {t("routes.stops", "Paradas")}
            </h3>

            {selectedPattern?.tripCount === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="bg-surface p-4 rounded-full mb-4 border border-border">
                  <Clock size={32} className="text-muted" />
                </div>
                <h4 className="text-lg font-bold text-text mb-1">
                  {t("routes.no_service_today", "Sin servicio hoy")}
                </h4>
                <p className="text-sm text-muted max-w-xs">
                  {t(
                    "routes.no_service_today_desc",
                    "Este trayecto no tiene viajes programados para la fecha seleccionada."
                  )}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {selectedPattern?.stops.map((stop, idx) => (
                <div
                  key={`${stop.id}-${idx}`}
                  ref={(el) => {
                    stopRefs.current[stop.id] = el;
                  }}
                  onClick={() =>
                    handleStopClick(stop.id, stop.lat, stop.lon, false)
                  }
                  className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    selectedStopId === stop.id
                      ? "bg-primary/5 border-primary"
                      : "bg-surface border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 ${selectedStopId === stop.id ? "bg-primary" : "bg-gray-400"}`}
                    ></div>
                    {idx < selectedPattern.stops.length - 1 && (
                      <div className="w-0.5 h-full bg-border -mb-2.5 mt-1"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-semibold text-text text-sm ${selectedStopId === stop.id ? "text-primary" : ""}`}
                    >
                      {stop.name}
                      {stop.code && (
                        <span
                          className={`text-[11px] font-normal ml-2 ${selectedStopId === stop.id ? "text-primary/70" : "text-gray-500"}`}
                        >
                          {stop.code}
                        </span>
                      )}
                    </p>

                    {(stop.pickupType === "NONE" ||
                      stop.dropOffType === "NONE") && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {stop.pickupType === "NONE" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <ArrowDownCircle size={10} />
                            {t("routes.drop_off_only", "Solo bajada")}
                          </span>
                        )}
                        {stop.dropOffType === "NONE" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            <ArrowUpCircle size={10} />
                            {t("routes.pickup_only", "Solo subida")}
                          </span>
                        )}
                      </div>
                    )}

                    {selectedStopId === stop.id && (
                      <Link
                        to={`/stops/${stop.id}`}
                        className="mt-1 inline-flex items-center text-xs font-semibold text-primary hover:underline"
                      >
                        {t("routes.view_stop", "Ver parada")}
                      </Link>
                    )}

                    {selectedStopId === stop.id &&
                      (departuresByStop.get(stop.id)?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(departuresByStop.get(stop.id) ?? []).map(
                            (item, i) => {
                              const isPast =
                                isTodaySelectedDate &&
                                item.departure < nowSeconds;
                              return (
                                <span
                                  key={`${item.patternId}-${item.departure}-${i}`}
                                  className={`text-[11px] px-2 py-0.5 rounded ${
                                    item.patternId === selectedPattern?.id
                                      ? "bg-gray-100 dark:bg-gray-900"
                                      : "bg-gray-50 dark:bg-gray-900 text-gray-400 font-light"
                                  } ${isPast ? "line-through opacity-50" : ""}`}
                                >
                                  {Math.floor(item.departure / 3600)
                                    .toString()
                                    .padStart(2, "0")}
                                  :
                                  {Math.floor((item.departure % 3600) / 60)
                                    .toString()
                                    .padStart(2, "0")}
                                </span>
                              );
                            }
                          )}
                        </div>
                      )}

                    {selectedStopId === stop.id && isTodaySelectedDate && (
                      <div className="mt-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted mb-1">
                          {t("routes.realtime", "Tiempo real")}
                        </div>
                        {isRealtimeLoading ? (
                          <div className="text-[11px] text-muted">
                            {t("routes.loading_realtime", "Cargando...")}
                          </div>
                        ) : (selectedStopEstimates?.arrivals.length ?? 0) ===
                          0 ? (
                          <div className="text-[11px] text-muted">
                            {t(
                              "routes.realtime_no_route_estimates",
                              "Sin estimaciones para esta línea"
                            )}
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const firstArrival =
                                selectedStopEstimates!.arrivals[0];
                              const isFirstSelectedPattern =
                                firstArrival.patternId === selectedPattern?.id;
                              return (
                                <div
                                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${isFirstSelectedPattern ? "border-green-500/30 bg-green-500/10" : "border-emerald-500/20 bg-emerald-500/5 opacity-50"}`}
                                >
                                  <span
                                    className={`text-[11px] font-semibold uppercase tracking-wide ${isFirstSelectedPattern ? "text-green-700 dark:text-green-300" : "text-emerald-700 dark:text-emerald-400"}`}
                                  >
                                    {t("routes.next_arrival", "Próximo")}
                                  </span>
                                  <span
                                    className={`inline-flex min-w-16 items-center justify-center rounded-xl px-3 py-1.5 text-base font-bold leading-none text-white ${isFirstSelectedPattern ? "bg-green-600" : "bg-emerald-600"}`}
                                  >
                                    {firstArrival.estimate.minutes}′
                                    {firstArrival.delay?.minutes
                                      ? formatDelayMinutes(
                                          firstArrival.delay.minutes
                                        )
                                      : ""}
                                  </span>
                                </div>
                              );
                            })()}

                            {selectedStopEstimates!.arrivals.length > 1 && (
                              <div className="mt-2 flex flex-wrap justify-end gap-1">
                                {selectedStopEstimates!.arrivals
                                  .slice(1)
                                  .map((arrival, i) => {
                                    const isSelectedPattern =
                                      arrival.patternId === selectedPattern?.id;
                                    return (
                                      <span
                                        key={`${arrival.tripId}-${i}`}
                                        className={`text-[11px] px-2 py-0.5 rounded ${
                                          isSelectedPattern
                                            ? "bg-gray-100 dark:bg-gray-900"
                                            : "bg-gray-50 dark:bg-gray-900 text-gray-400 font-light"
                                        }`}
                                        title={
                                          isSelectedPattern
                                            ? undefined
                                            : t(
                                                "routes.other_pattern",
                                                "Otro trayecto"
                                              )
                                        }
                                      >
                                        {arrival.estimate.minutes}′
                                        {arrival.delay?.minutes
                                          ? formatDelayMinutes(
                                              arrival.delay.minutes
                                            )
                                          : ""}
                                      </span>
                                    );
                                  })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
