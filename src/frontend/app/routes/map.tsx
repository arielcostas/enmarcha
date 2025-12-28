import { Check, X } from "lucide-react";
import type { FilterSpecification } from "maplibre-gl";
import { useMemo, useRef, useState } from "react";
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
import { PlannerOverlay } from "~/components/PlannerOverlay";
import { AppMap } from "~/components/shared/AppMap";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { reverseGeocode } from "~/data/PlannerApi";
import { usePlanner } from "~/hooks/usePlanner";
import StopDataProvider from "../data/StopDataProvider";
import "../tailwind-full.css";
import "./map.css";

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
  const mapRef = useRef<MapRef>(null);

  const {
    searchRoute,
    pickingMode,
    setPickingMode,
    setOrigin,
    setDestination,
    addRecentPlace,
  } = usePlanner({ autoLoad: false });

  const [isConfirming, setIsConfirming] = useState(false);

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
    } catch (err) {
      console.error("Failed to reverse geocode:", err);
    } finally {
      setIsConfirming(false);
    }
  };

  const onMapInteraction = () => {
    if (!pickingMode) {
      window.dispatchEvent(new CustomEvent("plannerOverlay:collapse"));
    }
  };

  const favouriteIds = useMemo(() => StopDataProvider.getFavouriteIds(), []);

  const favouriteFilter = useMemo(() => {
    if (favouriteIds.length === 0) return ["boolean", false];
    return ["match", ["get", "id"], favouriteIds, true, false];
  }, [favouriteIds]);

  // Handle click events on clusters and individual stops
  const onMapClick = (e: MapLayerMouseEvent) => {
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
    const feature = features[0];

    handlePointClick(feature);
  };

  const stopLayerFilter = useMemo(() => {
    const filter: any[] = ["any"];
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

  const getLatitude = (center: any) =>
    Array.isArray(center) ? center[0] : center.lat;
  const getLongitude = (center: any) =>
    Array.isArray(center) ? center[1] : center.lng;

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

    const stopId = props.id;
    const routes: {
      shortName: string;
      colour: string;
      textColour: string;
    }[] = JSON.parse(props.routes || "[]");

    setSelectedStop({
      stopId: props.id,
      stopCode: props.code,
      name: props.name || "Unknown Stop",
      lines: routes.map((route) => {
        return {
          line: route.shortName,
          colour: route.colour,
          textColour: route.textColour,
        };
      }),
    });
    setIsSheetOpen(true);
  };

  return (
    <div className="relative h-full">
      {!pickingMode && (
        <PlannerOverlay
          onSearch={(o, d, time, arriveBy) => searchRoute(o, d, time, arriveBy)}
          onNavigateToPlanner={() => navigate("/planner")}
          clearPickerOnOpen={true}
          showLastDestinationWhenCollapsed={false}
          cardBackground="bg-white/95 dark:bg-slate-900/90"
          autoLoad={false}
        />
      )}

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
        onClick={onMapClick}
        onDragStart={onMapInteraction}
        onZoomStart={onMapInteraction}
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
              "coach",
              2,
              "train",
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
            "text-size": ["interpolate", ["linear"], ["zoom"], 11, 8, 22, 16],
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
              "xunta",
              "#007BC4",
              "renfe",
              "#870164",
              "feve",
              "#EE3D32",
              "#27187D",
            ],
            "text-halo-color": "#FFF",
            "text-halo-width": 1,
          }}
        />

        {selectedStop && (
          <StopSummarySheet
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            stop={selectedStop}
          />
        )}
      </AppMap>
    </div>
  );
}
