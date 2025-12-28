import StopDataProvider from "../data/StopDataProvider";
import "./map.css";

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
import { usePlanner } from "~/hooks/usePlanner";
import "../tailwind-full.css";

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

  const { searchRoute } = usePlanner({ autoLoad: false });

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
      <PlannerOverlay
        onSearch={(o, d, time, arriveBy) => searchRoute(o, d, time, arriveBy)}
        onNavigateToPlanner={() => navigate("/planner")}
        clearPickerOnOpen={true}
        showLastDestinationWhenCollapsed={false}
        cardBackground="bg-white/95 dark:bg-slate-900/90"
        autoLoad={false}
      />

      <AppMap
        ref={mapRef}
        syncState={true}
        showNavigation={true}
        showGeolocate={true}
        interactiveLayerIds={["stops", "stops-label"]}
        onClick={onMapClick}
        attributionControl={{ compact: false }}
      >
        <Source
          id="stops-source"
          type="vector"
          tiles={[StopDataProvider.getTileUrlTemplate()]}
          minzoom={11}
          maxzoom={20}
        />

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
              "santiago",
              "#508096",
              "coruna",
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
