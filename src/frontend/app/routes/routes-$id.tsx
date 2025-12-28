import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layer, Source, type MapRef } from "react-map-gl/maplibre";
import { useParams } from "react-router";
import { fetchRouteDetails } from "~/api/transit";
import { AppMap } from "~/components/shared/AppMap";
import { usePageTitle } from "~/contexts/PageTitleContext";
import "../tailwind-full.css";

export default function RouteDetailsPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(
    null
  );
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const stopRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: route, isLoading } = useQuery({
    queryKey: ["route", id],
    queryFn: () => fetchRouteDetails(id!),
    enabled: !!id,
  });

  usePageTitle(
    route?.shortName
      ? `${route.shortName} - ${route.longName}`
      : t("routes.details", "Detalles de ruta")
  );

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

  const handleStopClick = (
    stopId: string,
    lat: number,
    lon: number,
    scroll = true
  ) => {
    setSelectedStopId(stopId);
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom: 16,
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
      <div className="p-4 bg-surface border-b border-border">
        <select
          className="w-full p-2 rounded-lg border border-border bg-background text-text focus:ring-2 focus:ring-primary outline-none"
          value={selectedPattern?.id}
          onChange={(e) => {
            setSelectedPatternId(e.target.value);
            setSelectedStopId(null);
          }}
        >
          {Object.entries(patternsByDirection).map(([dir, patterns]) => (
            <optgroup
              key={dir}
              label={
                dir === "0"
                  ? t("routes.direction_outbound", "Ida")
                  : t("routes.direction_inbound", "Vuelta")
              }
            >
              {patterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.code ? `${pattern.code.slice(-2)}: ` : ""}
                  {pattern.headsign || pattern.name}{" "}
                  {t("routes.trip_count_short", { count: pattern.tripCount })}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="h-1/2 relative">
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
            >
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
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-background">
            <h3 className="text-lg font-bold mb-4">
              {t("routes.stops", "Paradas")}
            </h3>
            <div className="space-y-4">
              {selectedPattern?.stops.map((stop, idx) => (
                <div
                  key={`${stop.id}-${idx}`}
                  ref={(el) => {
                    stopRefs.current[stop.id] = el;
                  }}
                  onClick={() =>
                    handleStopClick(stop.id, stop.lat, stop.lon, false)
                  }
                  className={`flex items-start gap-4 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedStopId === stop.id
                      ? "bg-primary/5 border-primary"
                      : "bg-surface border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full mt-1.5 ${selectedStopId === stop.id ? "bg-primary" : "bg-gray-400"}`}
                    ></div>
                    {idx < selectedPattern.stops.length - 1 && (
                      <div className="w-0.5 h-full bg-border -mb-3 mt-1"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text">
                      {stop.name}
                      {stop.code && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
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
