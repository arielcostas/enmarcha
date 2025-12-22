import StopDataProvider from "../data/StopDataProvider";
import "./map.css";

import { DEFAULT_STYLE, loadStyle } from "app/maps/styleloader";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Map, {
  GeolocateControl,
  Layer,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type StyleSpecification,
} from "react-map-gl/maplibre";
import { useNavigate } from "react-router";
import { PlannerOverlay } from "~/components/PlannerOverlay";
import {
  StopSheet,
  type StopSheetProps,
} from "~/components/map/StopSummarySheet";
import { APP_CONSTANTS } from "~/config/constants";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { usePlanner } from "~/hooks/usePlanner";
import { useApp } from "../AppContext";
import "../tailwind-full.css";

// Componente principal del mapa
export default function StopMap() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle(t("navbar.map", "Mapa"));
  const [selectedStop, setSelectedStop] = useState<
    StopSheetProps["stop"] | null
  >(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { mapState, updateMapState, theme } = useApp();
  const mapRef = useRef<MapRef>(null);

  const { searchRoute } = usePlanner();

  // Style state for Map component
  const [mapStyle, setMapStyle] = useState<StyleSpecification>(DEFAULT_STYLE);

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

  useEffect(() => {
    //const styleName = "carto";
    const styleName = "openfreemap";
    loadStyle(styleName, theme)
      .then((style) => setMapStyle(style))
      .catch((error) => console.error("Failed to load map style:", error));
  }, [theme]);

  useEffect(() => {
    const handleMapChange = () => {
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();
      if (!map) return;
      const center = map.getCenter();
      const zoom = map.getZoom();
      updateMapState([center.lat, center.lng], zoom);
    };

    const handleStyleImageMissing = (e: any) => {
      // Suppress warnings for missing sprite images from base style
      // This prevents console noise from OpenFreeMap's missing icons
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();
      if (!map || map.hasImage(e.id)) return;

      // Log warning for our own icons if they are missing
      if (e.id.startsWith("stop-")) {
        console.warn(`Missing icon image: ${e.id}`);
      }

      // Add a transparent 1x1 placeholder to prevent repeated warnings
      map.addImage(e.id, {
        width: 1,
        height: 1,
        data: new Uint8Array(4),
      });
    };

    if (mapRef.current) {
      const map = mapRef.current.getMap();
      if (map) {
        map.on("moveend", handleMapChange);
        map.on("styleimagemissing", handleStyleImageMissing);
      }
    }

    return () => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        if (map) {
          map.off("moveend", handleMapChange);
          map.off("styleimagemissing", handleStyleImageMissing);
        }
      }
    };
  }, [mapRef.current]);

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
    if (!props || feature.layer.id !== "stops") {
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
        console.log(route);
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
      />

      <Map
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["stops", "stops-label"]}
        onClick={onMapClick}
        minZoom={5}
        scrollZoom
        pitch={0}
        roll={0}
        ref={mapRef}
        initialViewState={{
          latitude: getLatitude(mapState.center),
          longitude: getLongitude(mapState.center),
          zoom: mapState.zoom,
        }}
        attributionControl={{ compact: false }}
        maxBounds={[APP_CONSTANTS.bounds.sw, APP_CONSTANTS.bounds.ne]}
      >
        <NavigationControl position="bottom-right" />
        <GeolocateControl
          position="bottom-right"
          trackUserLocation={true}
          positionOptions={{ enableHighAccuracy: false }}
        />

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
          layout={{
            // TODO: Fix ñapa by maybe including this from the server side?
            "icon-image": [
              "match",
              ["get", "feed"],
              "vitrasa",
              "stop-vitrasa",
              "santiago",
              "stop-santiago",
              "coruna",
              "stop-coruna",
              "xunta",
              "stop-xunta",
              "renfe",
              "stop-renfe",
              "feve",
              "stop-feve",
              "#stop-generic",
            ],
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
              "#95D516",
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
              "#333333",
            ],
            "text-halo-color": "#FFF",
            "text-halo-width": 1,
          }}
        />

        {selectedStop && (
          <StopSheet
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            stop={selectedStop}
          />
        )}
      </Map>
    </div>
  );
}
