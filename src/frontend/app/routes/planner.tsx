import { Coins, CreditCard, Footprints } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layer, Source, type MapRef } from "react-map-gl/maplibre";
import { useLocation } from "react-router";

import { type ConsolidatedCirculation } from "~/api/schema";
import LineIcon from "~/components/LineIcon";
import { PlannerOverlay } from "~/components/PlannerOverlay";
import { AppMap } from "~/components/shared/AppMap";
import { APP_CONSTANTS } from "~/config/constants";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { type Itinerary } from "~/data/PlannerApi";
import { usePlanner } from "~/hooks/usePlanner";
import "../tailwind-full.css";

const formatDistance = (meters: number) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  const rounded = Math.round(meters / 100) * 100;
  return `${rounded} m`;
};

const formatDuration = (minutes: number, t: any) => {
  if (minutes < 60) return `${minutes} ${t("estimates.minutes")}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const haversineMeters = (a: [number, number], b: [number, number]) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const sumWalkMetrics = (legs: Itinerary["legs"]) => {
  let meters = 0;
  let minutes = 0;

  legs.forEach((leg) => {
    if (leg.mode === "WALK") {
      if (
        typeof (leg as any).distanceMeters === "number" &&
        (leg as any).distanceMeters > 0
      ) {
        meters += (leg as any).distanceMeters;
      } else if (leg.geometry?.coordinates?.length) {
        for (let i = 1; i < leg.geometry.coordinates.length; i++) {
          const prev = leg.geometry.coordinates[i - 1] as [number, number];
          const curr = leg.geometry.coordinates[i] as [number, number];
          meters += haversineMeters(prev, curr);
        }
      }
      const durationMinutes =
        (new Date(leg.endTime).getTime() - new Date(leg.startTime).getTime()) /
        60000;
      minutes += durationMinutes;
    }
  });

  return { meters, minutes: Math.max(0, Math.round(minutes)) };
};

const ItinerarySummary = ({
  itinerary,
  onClick,
}: {
  itinerary: Itinerary;
  onClick: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const durationMinutes = Math.round(itinerary.durationSeconds / 60);
  const startTime = new Date(itinerary.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
  const endTime = new Date(itinerary.endTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });

  const walkTotals = sumWalkMetrics(itinerary.legs);
  const cashFare = (itinerary.cashFare ?? 0).toFixed(2);
  const cardFare = (itinerary.cardFare ?? 0).toFixed(2);

  return (
    <div
      className="bg-surface p-4 rounded-lg shadow mb-3 cursor-pointer hover:bg-surface/80 border border-border"
      onClick={onClick}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="font-bold text-lg text-text">
          {startTime} - {endTime}
        </div>
        <div className="text-muted">{formatDuration(durationMinutes, t)}</div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {itinerary.legs.map((leg, idx) => {
          const isWalk = leg.mode === "WALK";
          const legDurationMinutes = Math.max(
            1,
            Math.round(
              (new Date(leg.endTime).getTime() -
                new Date(leg.startTime).getTime()) /
                60000
            )
          );

          const isFirstBusLeg =
            !isWalk &&
            itinerary.legs.findIndex((l) => l.mode !== "WALK") === idx;

          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-muted/50">›</span>}
              {isWalk ? (
                <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm text-text whitespace-nowrap border border-border">
                  <Footprints className="w-4 h-4 text-muted" />
                  <span className="font-semibold">
                    {formatDuration(legDurationMinutes, t)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LineIcon
                    line={leg.routeShortName || leg.routeName || leg.mode || ""}
                    mode="pill"
                    colour={leg.routeColor || undefined}
                    textColour={leg.routeTextColor || undefined}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-sm text-muted mt-1">
        <span>
          {t("planner.walk")}: {formatDistance(walkTotals.meters)}
          {walkTotals.minutes
            ? ` • ${formatDuration(walkTotals.minutes, t)}`
            : ""}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-text">
            <Coins className="w-4 h-4" />
            {cashFare === "0.00"
              ? t("planner.free")
              : t("planner.fare", { amount: cashFare })}
            {itinerary.cashFareIsTotal ? "" : "++"}
          </span>
          <span className="flex items-center gap-1 text-muted">
            <CreditCard className="w-4 h-4" />
            {cardFare === "0.00"
              ? t("planner.free")
              : t("planner.fare", { amount: cardFare })}
            {itinerary.cashFareIsTotal ? "" : "++"}
          </span>
        </span>
      </div>
    </div>
  );
};

const ItineraryDetail = ({
  itinerary,
  onClose,
}: {
  itinerary: Itinerary;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const mapRef = useRef<MapRef>(null);
  const { destination: userDestination } = usePlanner();
  const [nextArrivals, setNextArrivals] = useState<
    Record<string, ConsolidatedCirculation[]>
  >({});

  const routeGeoJson = {
    type: "FeatureCollection",
    features: itinerary.legs.map((leg) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: leg.geometry?.coordinates || [],
      },
      properties: {
        mode: leg.mode,
        color:
          leg.mode === "WALK"
            ? "#9ca3af"
            : leg.routeColor
              ? `#${leg.routeColor}`
              : "#2563eb",
      },
    })),
  };

  // Create GeoJSON for all markers
  const markersGeoJson = useMemo(() => {
    const features: any[] = [];

    // Add points for each leg transition
    itinerary.legs.forEach((leg, idx) => {
      // Add "from" point of the leg
      if (leg.from?.lat && leg.from?.lon) {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [leg.from.lon, leg.from.lat],
          },
          properties: {
            type: idx === 0 ? "origin" : "transfer",
            name: leg.from.name || "",
            index: idx.toString(),
          },
        });
      }

      // If it's the last leg, also add the "to" point
      if (idx === itinerary.legs.length - 1 && leg.to?.lat && leg.to?.lon) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [leg.to.lon, leg.to.lat] },
          properties: {
            type: "destination",
            name: leg.to.name || "",
            index: (idx + 1).toString(),
          },
        });
      }

      // Add intermediate stops
      leg.intermediateStops?.forEach((stop) => {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
          properties: {
            type: "intermediate",
            name: stop.name || "Intermediate stop",
          },
        });
      });
    });

    return { type: "FeatureCollection", features };
  }, [itinerary]);

  // Get origin and destination coordinates
  const origin = itinerary.legs[0]?.from;
  const destination = itinerary.legs[itinerary.legs.length - 1]?.to;

  useEffect(() => {
    if (!mapRef.current) return;

    // Small delay to ensure map is fully loaded
    const timer = setTimeout(() => {
      if (mapRef.current && itinerary.legs.length > 0) {
        const bounds = new maplibregl.LngLatBounds();

        // Add all route coordinates to bounds
        itinerary.legs.forEach((leg) => {
          leg.geometry?.coordinates.forEach((coord) =>
            bounds.extend([coord[0], coord[1]])
          );
        });

        // Also include markers (origin, destination, transfers, intermediate) so all are visible
        markersGeoJson.features.forEach((feature: any) => {
          if (
            feature.geometry?.type === "Point" &&
            Array.isArray(feature.geometry.coordinates)
          ) {
            const [lng, lat] = feature.geometry.coordinates as [number, number];
            bounds.extend([lng, lat]);
          }
        });

        // Ensure bounds are valid before fitting
        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, { padding: 80, duration: 1000 });
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [mapRef.current, itinerary]);

  // Fetch next arrivals for bus legs
  useEffect(() => {
    const fetchArrivals = async () => {
      const arrivalsByStop: Record<string, ConsolidatedCirculation[]> = {};

      for (const leg of itinerary.legs) {
        if (leg.mode !== "WALK" && leg.from?.stopId) {
          const stopKey = leg.from.name || leg.from.stopId;
          if (!arrivalsByStop[stopKey]) {
            try {
              //TODO: Allow multiple stops one request
              const resp = await fetch(
                `/api/stops/arrivals?id=${encodeURIComponent(leg.from.stopId)}`,
                { headers: { Accept: "application/json" } }
              );

              if (resp.ok) {
                arrivalsByStop[stopKey] = await resp.json() satisfies ConsolidatedCirculation[];
              }
            } catch (err) {
              console.warn(
                `Failed to fetch arrivals for ${leg.from.stopId}:`,
                err
              );
            }
          }
        }
      }

      setNextArrivals(arrivalsByStop);
    };

    fetchArrivals();
  }, [itinerary]);

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Map Section */}
      <div className="relative h-2/3 md:h-full md:flex-1">
        <AppMap
          ref={mapRef}
          initialViewState={{
            longitude:
              origin?.lon ||
              (APP_CONSTANTS.defaultCenter as [number, number])[0],
            latitude:
              origin?.lat ||
              (APP_CONSTANTS.defaultCenter as [number, number])[1],
            zoom: 13,
          }}
          showTraffic={false}
          showGeolocate={true}
          showNavigation={true}
          attributionControl={true}
        >
          <Source id="route" type="geojson" data={routeGeoJson as any}>
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{
                "line-color": ["get", "color"],
                "line-width": 5,
                "line-dasharray": [
                  "case",
                  ["==", ["get", "mode"], "WALK"],
                  ["literal", [1, 3]],
                  ["literal", [1, 0]],
                ],
              }}
            />
          </Source>

          {/* All markers as GeoJSON layers */}
          <Source id="markers" type="geojson" data={markersGeoJson as any}>
            {/* Intermediate stops (smaller white dots) - rendered first to be at the bottom */}
            <Layer
              id="markers-intermediate"
              type="circle"
              filter={["==", ["get", "type"], "intermediate"]}
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  10,
                  3,
                  16,
                  5,
                  20,
                  7,
                ],
                "circle-color": "#ffffff",
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#6b7280",
              }}
            />
            {/* Outer circle for all numbered markers */}
            <Layer
              id="markers-outer"
              type="circle"
              filter={[
                "in",
                ["get", "type"],
                ["literal", ["origin", "destination", "transfer"]],
              ]}
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  10,
                  8,
                  16,
                  10,
                  20,
                  12,
                ],
                "circle-color": [
                  "case",
                  ["==", ["get", "type"], "origin"],
                  "#dc2626",
                  ["==", ["get", "type"], "destination"],
                  "#16a34a",
                  "#3b82f6",
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              }}
            />
            {/* Numbers for markers */}
            <Layer
              id="markers-labels"
              type="symbol"
              filter={[
                "in",
                ["get", "type"],
                ["literal", ["origin", "destination", "transfer"]],
              ]}
              layout={{
                "text-field": ["get", "index"],
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  10,
                  8,
                  16,
                  10,
                  20,
                  12,
                ],
                "text-allow-overlap": true,
              }}
              paint={{
                "text-color": "#ffffff",
              }}
            />
          </Source>
        </AppMap>

        <button
          onClick={onClose}
          className="absolute top-4 left-4 bg-white dark:bg-slate-800 p-2 px-4 rounded-lg shadow-lg z-10 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          {t("planner.back")}
        </button>
      </div>

      {/* Details Panel */}
      <div className="h-1/3 md:h-full md:w-96 lg:w-lg overflow-y-auto bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
        <div className="px-4 py-4">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">
            {t("planner.itinerary_details")}
          </h2>

          <div>
            {itinerary.legs.map((leg, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center w-20 shrink-0">
                  {leg.mode === "WALK" ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
                      style={{ backgroundColor: "#e5e7eb", color: "#374151" }}
                    >
                      <Footprints className="w-4 h-4" />
                    </div>
                  ) : (
                    <LineIcon
                      line={leg.routeShortName || leg.routeName || ""}
                      mode="rounded"
                      colour={leg.routeColor || undefined}
                      textColour={leg.routeTextColor || undefined}
                    />
                  )}
                  {idx < itinerary.legs.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-300 dark:bg-gray-600 my-1"></div>
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="font-bold flex items-center gap-2">
                    {leg.mode === "WALK" ? (
                      t("planner.walk")
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted font-bold leading-none mb-1">
                          {t("planner.direction")}
                        </span>
                        <span className="leading-tight">
                          {leg.headsign ||
                            leg.routeLongName ||
                            leg.routeName ||
                            ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    <span>
                      {new Date(leg.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Madrid",
                      })}{" "}
                    </span>
                    <span>•</span>
                    <span>
                      {formatDuration(
                        Math.round(
                          (new Date(leg.endTime).getTime() -
                            new Date(leg.startTime).getTime()) /
                            60000
                        ),
                        t
                      )}
                    </span>
                    <span>•</span>
                    <span>{formatDistance(leg.distanceMeters)}</span>
                    {leg.agencyName && (
                      <>
                        <span>•</span>
                        <span className="italic">{leg.agencyName}</span>
                      </>
                    )}
                  </div>
                  {leg.mode !== "WALK" &&
                    leg.from?.stopId &&
                    nextArrivals[leg.from.name || leg.from.stopId] && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="font-semibold mb-1">
                          {t("planner.next_arrivals", "Next arrivals")}:
                        </div>
                        {(() => {
                          const currentLine =
                            leg.routeShortName || leg.routeName;
                          const previousLeg =
                            idx > 0 ? itinerary.legs[idx - 1] : null;
                          const previousLine =
                            previousLeg?.mode !== "WALK"
                              ? previousLeg?.routeShortName ||
                                previousLeg?.routeName
                              : null;

                          const linesToShow = [currentLine];
                          if (
                            previousLine &&
                            previousLeg?.to?.stopId === leg.from?.stopId
                          ) {
                            linesToShow.push(previousLine);
                          }

                          return nextArrivals[leg.from.stopId]
                            ?.filter((circ) => linesToShow.includes(circ.line))
                            .slice(0, 3)
                            .map((circ, idx) => {
                              const minutes =
                                circ.realTime?.minutes ??
                                circ.schedule?.minutes;
                              if (minutes === undefined) return null;
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 py-0.5"
                                >
                                  <span className="font-semibold">
                                    {circ.line}
                                  </span>
                                  <span className="text-gray-500 dark:text-gray-500">
                                    →
                                  </span>
                                  <span className="flex-1 truncate">
                                    {circ.route}
                                  </span>
                                  <span className="font-semibold text-primary-600 dark:text-primary-400">
                                    {formatDuration(minutes, t)}
                                    {circ.realTime && " 🟢"}
                                  </span>
                                </div>
                              );
                            });
                        })()}
                      </div>
                    )}
                  <div className="text-sm mt-1">
                    {leg.mode === "WALK" ? (
                      <span>
                        {t("planner.walk_to", {
                          distance: Math.round(leg.distanceMeters) + "m",
                          destination: (() => {
                            const enteredDest = userDestination?.name || "";
                            const finalDest =
                              enteredDest ||
                              itinerary.legs[itinerary.legs.length - 1]?.to
                                ?.name ||
                              "";
                            const raw = leg.to?.name || finalDest || "";
                            const cleaned = raw.trim();
                            const placeholder = cleaned.toLowerCase();
                            // If OTP provided a generic placeholder, use the user's entered destination
                            if (
                              placeholder === "destination" ||
                              placeholder === "destino" ||
                              placeholder === "destinación" ||
                              placeholder === "destinatario"
                            ) {
                              return enteredDest || finalDest;
                            }
                            return cleaned || finalDest;
                          })(),
                        })}
                      </span>
                    ) : (
                      <>
                        <span>
                          {t("planner.from_to", {
                            from: leg.from?.name,
                            to: leg.to?.name,
                          })}
                        </span>
                        {leg.intermediateStops &&
                          leg.intermediateStops.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                                {leg.intermediateStops.length}{" "}
                                {leg.intermediateStops.length === 1
                                  ? "stop"
                                  : "stops"}
                              </summary>
                              <ul className="mt-1 ml-4 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                {leg.intermediateStops.map((stop, idx) => (
                                  <li key={idx}>• {stop.name}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PlannerPage() {
  const { t } = useTranslation();
  usePageTitle(t("navbar.planner", "Planificador"));
  const location = useLocation();
  const {
    plan,
    loading,
    searchRoute,
    clearRoute,
    searchTime,
    arriveBy,
    selectedItineraryIndex,
    selectItinerary,
    deselectItinerary,
    setOrigin,
    setDestination,
  } = usePlanner();
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(
    null
  );

  // Show previously selected itinerary when plan loads
  useEffect(() => {
    if (
      plan &&
      selectedItineraryIndex !== null &&
      plan.itineraries[selectedItineraryIndex]
    ) {
      setSelectedItinerary(plan.itineraries[selectedItineraryIndex]);
    } else {
      setSelectedItinerary(null);
    }
  }, [plan, selectedItineraryIndex]);

  // Intercept back button when viewing itinerary detail
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (selectedItinerary) {
        e.preventDefault();
        setSelectedItinerary(null);
        deselectItinerary();
        window.history.pushState(null, "", window.location.href);
      }
    };

    if (selectedItinerary) {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", handlePopState);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [selectedItinerary, deselectItinerary]);

  if (selectedItinerary) {
    return (
      <ItineraryDetail
        itinerary={selectedItinerary}
        onClose={() => {
          setSelectedItinerary(null);
          deselectItinerary();
        }}
      />
    );
  }

  // Format search time for display
  const searchTimeDisplay = searchTime
    ? new Date(searchTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      })
    : null;

  return (
    <div className="relative max-w-3xl mx-auto px-4 pt-4 pb-8">
      <PlannerOverlay
        forceExpanded
        inline
        onSearch={(origin, destination, time, arriveBy) =>
          searchRoute(origin, destination, time, arriveBy)
        }
        cardBackground="bg-transparent"
      />

      {loading && !plan && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted">{t("planner.searching")}</p>
        </div>
      )}

      {plan && (
        <div>
          <div className="flex justify-between items-center my-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {t("planner.results_title")}
              </h2>
              {searchTimeDisplay && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {arriveBy ? t("planner.arrive_by") : t("planner.depart_at")}{" "}
                  {searchTimeDisplay}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                clearRoute();
                setDestination(null);
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                      const initial = {
                        name: t("planner.current_location"),
                        label: "GPS",
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        layer: "current-location",
                      } as any;
                      setOrigin(initial);
                    },
                    () => {
                      // If geolocation fails, just keep origin empty
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }
              }}
              className="text-sm text-red-500"
            >
              {t("planner.clear")}
            </button>
          </div>

          {plan.itineraries.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-600">
              <div className="text-4xl mb-2">😕</div>
              <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-slate-100">
                {t("planner.no_routes_found")}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t("planner.no_routes_message")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {plan.itineraries.map((itinerary, idx) => (
                <ItinerarySummary
                  key={idx}
                  itinerary={itinerary}
                  onClick={() => {
                    selectItinerary(idx);
                    setSelectedItinerary(itinerary);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
