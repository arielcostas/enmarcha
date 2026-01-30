import { useQuery } from "@tanstack/react-query";
import {
  Bus,
  ChevronDown,
  Clock,
  LayoutGrid,
  List,
  Map as MapIcon,
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
import { useParams } from "react-router";
import { fetchRouteDetails } from "~/api/transit";
import { AppMap } from "~/components/shared/AppMap";
import {
  useBackButton,
  usePageTitle,
  usePageTitleNode,
} from "~/contexts/PageTitleContext";
import "../tailwind-full.css";

export default function RouteDetailsPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(
    null
  );
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

  const { data: route, isLoading } = useQuery({
    queryKey: ["route", id, selectedDateKey],
    queryFn: () => fetchRouteDetails(id!, selectedDateKey),
    enabled: !!id,
  });

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
              color: route.color ? `#${route.color}` : "var(--text-color)",
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

  useBackButton({ to: "/routes" });

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

  const activePatterns = route.patterns.filter((p) => p.tripCount > 0);

  const patternsByDirection = activePatterns.reduce(
    (acc, pattern) => {
      const dir = pattern.directionId;
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push(pattern);
      return acc;
    },
    {} as Record<number, typeof route.patterns>
  );

  const selectedPattern =
    activePatterns.find((p) => p.id === selectedPatternId) || activePatterns[0];

  const selectedPatternLabel = selectedPattern
    ? selectedPattern.headsign || selectedPattern.name
    : t("routes.details", "Detalles de ruta");

  const mapHeightClass =
    layoutMode === "map"
      ? "h-[75%] md:h-[75%]"
      : layoutMode === "list"
        ? "h-[25%] md:h-[25%]"
        : "h-[50%] md:h-[50%]";

  const layoutOptions = [
    {
      id: "balanced",
      label: t("routes.layout_balanced", "Equilibrada"),
      icon: LayoutGrid,
    },
    {
      id: "map",
      label: t("routes.layout_map", "Mapa"),
      icon: MapIcon,
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
                    id="route-line"
                    type="line"
                    paint={{
                      "line-color": route.color ? `#${route.color}` : "#3b82f6",
                      "line-width": 4,
                      "line-opacity": 0.8,
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
                    "circle-color": "#ffffff",
                    "circle-stroke-width": 2,
                    "circle-stroke-color": route.color
                      ? `#${route.color}`
                      : "#3b82f6",
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
                className="w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[75%] overflow-hidden"
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
                        <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide">
                          {directionLabel}
                        </div>
                        <div className="space-y-2 px-3 pb-3">
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
                                  setSelectedPatternId(pattern.id);
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
                    <p className="font-semibold text-text text-sm">
                      {stop.name}
                      {stop.code && (
                        <span className="text-[11px] font-normal text-gray-500 ml-2">
                          {stop.code}
                        </span>
                      )}
                    </p>

                    {selectedStopId === stop.id &&
                      stop.scheduledDepartures.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {stop.scheduledDepartures.map((dep, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded"
                            >
                              {Math.floor(dep / 3600)
                                .toString()
                                .padStart(2, "0")}
                              :
                              {Math.floor((dep % 3600) / 60)
                                .toString()
                                .padStart(2, "0")}
                            </span>
                          ))}
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
