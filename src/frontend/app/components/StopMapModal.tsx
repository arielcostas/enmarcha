import maplibregl from "maplibre-gl";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import { Sheet } from "react-modal-sheet";
import { useApp } from "~/AppContext";
import { APP_CONSTANTS } from "~/config/constants";
import { getLineColour } from "~/data/LineColors";
import type { Stop } from "~/data/StopDataProvider";
import { loadStyle } from "~/maps/styleloader";
import "./StopMapModal.css";

export interface Position {
  latitude: number;
  longitude: number;
  orientationDegrees: number;
  shapeIndex?: number;
}

export interface ConsolidatedCirculationForMap {
  id: string;
  line: string;
  route: string;
  currentPosition?: Position;
  stopShapeIndex?: number;
  isPreviousTrip?: boolean;
  previousTripShapeId?: string;
  schedule?: {
    shapeId?: string;
  };
}

interface StopMapModalProps {
  stop: Stop;
  circulations: ConsolidatedCirculationForMap[];
  isOpen: boolean;
  onClose: () => void;
  selectedCirculationId?: string;
}

export const StopMapModal: React.FC<StopMapModalProps> = ({
  stop,
  circulations,
  isOpen,
  onClose,
  selectedCirculationId,
}) => {
  const { theme } = useApp();
  const [styleSpec, setStyleSpec] = useState<any | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const hasFitBounds = useRef(false);
  const userInteracted = useRef(false);
  const [shapeData, setShapeData] = useState<any | null>(null);
  const [previousShapeData, setPreviousShapeData] = useState<any | null>(null);

  // Filter circulations that have GPS coordinates
  const busesWithPosition = useMemo(
    () => circulations.filter((c) => !!c.currentPosition),
    [circulations]
  );

  // Use selectedCirculationId if provided, otherwise use first bus with position
  const selectedBus = useMemo(() => {
    if (selectedCirculationId !== undefined) {
      const circulation = circulations.find(
        (c) => c.id === selectedCirculationId
      );
      if (circulation?.currentPosition) {
        return circulation;
      }
    }
    // Fallback to first bus with position
    return busesWithPosition.length > 0 ? busesWithPosition[0] : null;
  }, [selectedCirculationId, circulations, busesWithPosition]);

  const center = useMemo(() => {
    if (selectedBus?.currentPosition) {
      return {
        latitude: selectedBus.currentPosition.latitude,
        longitude: selectedBus.currentPosition.longitude,
      };
    }
    if (stop.latitude && stop.longitude) {
      return { latitude: stop.latitude, longitude: stop.longitude };
    }
    return { latitude: 42.2406, longitude: -8.7207 }; // Vigo approx fallback
  }, [selectedBus, stop.latitude, stop.longitude]);

  const handleCenter = useCallback(() => {
    if (!mapRef.current) return;
    if (userInteracted.current) return;

    const points: { lat: number; lon: number }[] = [];

    const addShapePoints = (data: any) => {
      if (
        data?.properties?.busPoint &&
        data?.properties?.stopPoint &&
        data?.geometry?.coordinates
      ) {
        const busIdx = data.properties.busPoint.index;
        const stopIdx = data.properties.stopPoint.index;
        const coords = data.geometry.coordinates;

        const start = Math.min(busIdx, stopIdx);
        const end = Math.max(busIdx, stopIdx);

        for (let i = start; i <= end; i++) {
          points.push({ lat: coords[i][1], lon: coords[i][0] });
        }
      }
    };

    addShapePoints(shapeData);
    addShapePoints(previousShapeData);

    if (points.length === 0) {
      if (stop.latitude && stop.longitude) {
        points.push({ lat: stop.latitude, lon: stop.longitude });
      }

      if (selectedBus?.currentPosition) {
        points.push({
          lat: selectedBus.currentPosition.latitude,
          lon: selectedBus.currentPosition.longitude,
        });
      }
    }

    if (points.length === 0) return;

    let minLat = points[0].lat,
      maxLat = points[0].lat,
      minLon = points[0].lon,
      maxLon = points[0].lon;
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }

    const sw = [minLon, minLat] as [number, number];
    const ne = [maxLon, maxLat] as [number, number];
    const bounds = new maplibregl.LngLatBounds(sw, ne);

    try {
      if (points.length === 1) {
        const only = points[0];
        mapRef.current
          .getMap()
          .easeTo({ center: [only.lon, only.lat], zoom: 16, duration: 450 });
      } else {
        mapRef.current.fitBounds(bounds, {
          padding: 80,
          duration: 500,
          maxZoom: 17,
        } as any);
      }
    } catch {}
  }, [stop, selectedBus, shapeData, previousShapeData]);

  // Load style without traffic layers for the stop map
  useEffect(() => {
    let mounted = true;
    loadStyle("openfreemap", theme, { includeTraffic: false })
      .then((style) => {
        if (mounted) setStyleSpec(style);
      })
      .catch((err) => console.error("Failed to load map style", err));
    return () => {
      mounted = false;
    };
  }, [theme]);

  // Resize map and fit bounds when modal opens
  useEffect(() => {
    if (isOpen && mapRef.current) {
      const timer = setTimeout(() => {
        const map = mapRef.current?.getMap();
        if (map) {
          map.resize();
          // Trigger fit bounds logic again
          hasFitBounds.current = false;
          handleCenter();
        }
      }, 300); // Wait for sheet animation
      return () => clearTimeout(timer);
    }
  }, [isOpen, handleCenter]);

  // Fit bounds on initial load
  useEffect(() => {
    if (!styleSpec || !mapRef.current || hasFitBounds.current || !isOpen)
      return;

    const map = mapRef.current.getMap();

    // Handle missing sprite images to suppress console warnings
    const handleStyleImageMissing = (e: any) => {
      if (!map || map.hasImage(e.id)) return;
      map.addImage(e.id, {
        width: 1,
        height: 1,
        data: new Uint8Array(4),
      });
    };

    map.on("styleimagemissing", handleStyleImageMissing);

    handleCenter();
    hasFitBounds.current = true;

    return () => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        if (map) {
          map.off("styleimagemissing", handleStyleImageMissing);
        }
      }
    };
  }, [styleSpec, stop, selectedBus, isOpen, handleCenter]);

  // Reset bounds when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      hasFitBounds.current = false;
      userInteracted.current = false;
      setShapeData(null);
      setPreviousShapeData(null);
    }
  }, [isOpen]);

  // Fetch shape for selected bus
  useEffect(() => {
    if (
      !isOpen ||
      !selectedBus ||
      !selectedBus.schedule?.shapeId ||
      selectedBus.currentPosition?.shapeIndex === undefined ||
      !APP_CONSTANTS.shapeEndpoint
    ) {
      setShapeData(null);
      setPreviousShapeData(null);
      return;
    }

    const shapeId = selectedBus.schedule.shapeId;
    const shapeIndex = selectedBus.currentPosition.shapeIndex;
    const stopShapeIndex = selectedBus.stopShapeIndex;
    const stopLat = stop.latitude;
    const stopLon = stop.longitude;

    const fetchShape = async (
      sId: string,
      bIndex?: number,
      sIndex?: number,
      sLat?: number,
      sLon?: number
    ) => {
      let url = `${APP_CONSTANTS.shapeEndpoint}?shapeId=${sId}`;
      if (bIndex !== undefined) url += `&busShapeIndex=${bIndex}`;
      if (sIndex !== undefined) url += `&stopShapeIndex=${sIndex}`;
      else if (sLat && sLon) url += `&stopLat=${sLat}&stopLon=${sLon}`;

      const res = await fetch(url);
      if (res.ok) return res.json();
      return null;
    };

    const loadShapes = async () => {
      if (selectedBus.isPreviousTrip && selectedBus.previousTripShapeId) {
        // Bus is on previous trip
        // 1. Load previous shape (where bus is)
        const prevData = await fetchShape(
          selectedBus.previousTripShapeId,
          shapeIndex,
          stopShapeIndex
        );

        // 2. Load current scheduled shape (where bus is going)
        // Bus is not on this shape yet, so no bus index
        const currData = await fetchShape(
          shapeId,
          undefined,
          undefined,
          stopLat,
          stopLon
        );

        if (
          prevData &&
          prevData.geometry &&
          prevData.geometry.coordinates &&
          prevData.properties?.busPoint?.index !== undefined
        ) {
          const busIdx = prevData.properties.busPoint.index;
          const coords = prevData.geometry.coordinates;
          // Slice from busIdx - 5 (clamped to 0) to end
          const startIdx = Math.max(0, busIdx - 5);
          const slicedCoords = coords.slice(startIdx);

          // Join with the first point of the next shape to close the gap
          if (currData?.geometry?.coordinates?.length > 0) {
            slicedCoords.push(currData.geometry.coordinates[0]);
          }

          prevData.geometry.coordinates = slicedCoords;
        }

        setPreviousShapeData(prevData);
        setShapeData(currData);
      } else {
        // Normal case
        const data = await fetchShape(
          shapeId,
          shapeIndex,
          stopShapeIndex,
          stopLat,
          stopLon
        );
        setShapeData(data);
        setPreviousShapeData(null);
      }
      handleCenter();
    };

    loadShapes().catch((err) => console.error("Failed to load shape", err));
  }, [isOpen, selectedBus]);

  if (busesWithPosition.length === 0) {
    return null; // Don't render if no buses with GPS coordinates
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container style={{ backgroundColor: "var(--background-color)" }}>
        <Sheet.Header />
        <Sheet.Content disableDrag={true}>
          <div className="stop-map-modal">
            {/* Map Container */}
            <div className="stop-map-modal__map-container">
              {styleSpec && (
                <Map
                  mapLib={maplibregl as any}
                  initialViewState={{
                    latitude: center.latitude,
                    longitude: center.longitude,
                    zoom: 16,
                  }}
                  style={{ width: "100%", height: "50vh" }}
                  mapStyle={styleSpec}
                  attributionControl={{
                    compact: false,
                    customAttribution:
                      "Concello de Vigo & Viguesa de Transportes SL",
                  }}
                  ref={mapRef}
                  interactive={true}
                  onMove={(e) => {
                    if (e.originalEvent) {
                      userInteracted.current = true;
                    }
                  }}
                  onDragStart={() => {
                    userInteracted.current = true;
                  }}
                  onZoomStart={() => {
                    userInteracted.current = true;
                  }}
                  onRotateStart={() => {
                    userInteracted.current = true;
                  }}
                  onPitchStart={() => {
                    userInteracted.current = true;
                  }}
                >
                  {/* Previous Shape Layer */}
                  {previousShapeData && selectedBus && (
                    <Source
                      id="prev-route-shape"
                      type="geojson"
                      data={previousShapeData}
                    >
                      {/* 1. Black border */}
                      <Layer
                        id="prev-route-shape-border"
                        type="line"
                        paint={{
                          "line-color": "#000000",
                          "line-width": 6,
                          "line-opacity": 0.8,
                        }}
                        layout={{
                          "line-cap": "round",
                          "line-join": "round",
                        }}
                      />
                      {/* 2. White background */}
                      <Layer
                        id="prev-route-shape-white"
                        type="line"
                        paint={{
                          "line-color": "#FFFFFF",
                          "line-width": 4,
                        }}
                        layout={{
                          "line-cap": "round",
                          "line-join": "round",
                        }}
                      />
                      {/* 3. Colored dashes */}
                      <Layer
                        id="prev-route-shape-inner"
                        type="line"
                        paint={{
                          "line-color": getLineColour(selectedBus.line)
                            .background,
                          "line-width": 4,
                          "line-dasharray": [2, 2],
                        }}
                        layout={{
                          "line-cap": "round",
                          "line-join": "round",
                        }}
                      />
                    </Source>
                  )}

                  {/* Shape Layer */}
                  {shapeData && selectedBus && (
                    <Source id="route-shape" type="geojson" data={shapeData}>
                      <Layer
                        id="route-shape-border"
                        type="line"
                        paint={{
                          "line-color": "#000000",
                          "line-width": 5,
                          "line-opacity": 0.6,
                        }}
                        layout={{
                          "line-cap": "round",
                          "line-join": "round",
                        }}
                      />
                      <Layer
                        id="route-shape-inner"
                        type="line"
                        paint={{
                          "line-color": getLineColour(selectedBus.line)
                            .background,
                          "line-width": 3,
                          "line-opacity": 0.7,
                        }}
                        layout={{
                          "line-cap": "round",
                          "line-join": "round",
                        }}
                      />
                    </Source>
                  )}

                  {/* Stop marker */}
                  {stop.latitude && stop.longitude && (
                    <Marker
                      longitude={stop.longitude}
                      latitude={stop.latitude}
                      anchor="bottom"
                    >
                      <div title={`Stop ${stop.stopId}`}>
                        <svg width="28" height="36" viewBox="0 0 28 36">
                          <defs>
                            <filter
                              id="drop-stop"
                              x="-20%"
                              y="-20%"
                              width="140%"
                              height="140%"
                            >
                              <feDropShadow
                                dx="0"
                                dy="1"
                                stdDeviation="1"
                                floodOpacity={0.35}
                              />
                            </filter>
                          </defs>
                          <path
                            d="M14 0C6.82 0 1 5.82 1 13c0 8.5 11 23 13 23s13-14.5 13-23C27 5.82 21.18 0 14 0z"
                            fill="#1976d2"
                            stroke="#fff"
                            strokeWidth="2"
                            filter="url(#drop-stop)"
                          />
                          <circle cx="14" cy="13" r="5" fill="#fff" />
                          <circle cx="14" cy="13" r="3" fill="#1976d2" />
                        </svg>
                      </div>
                    </Marker>
                  )}

                  {/* Selected bus marker */}
                  {selectedBus?.currentPosition && (
                    <Marker
                      longitude={selectedBus.currentPosition.longitude}
                      latitude={selectedBus.currentPosition.latitude}
                      anchor="center"
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          transform: `rotate(${selectedBus.currentPosition.orientationDegrees}deg)`,
                          transformOrigin: "center center",
                        }}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          style={{
                            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                          }}
                        >
                          <path
                            d="M12 2 L22 22 L12 17 L2 22 Z"
                            fill={getLineColour(selectedBus.line).background}
                            stroke="#000"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </Marker>
                  )}
                </Map>
              )}

              {/* Floating controls */}
              <div className="map-modal-controls">
                <button
                  type="button"
                  aria-label="Center"
                  className="center-btn"
                  onClick={() => {
                    userInteracted.current = false;
                    handleCenter();
                  }}
                  title="Center view"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                    <path
                      d="M12 2v3M12 19v3M2 12h3M19 12h3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onClick={onClose} />
    </Sheet>
  );
};
