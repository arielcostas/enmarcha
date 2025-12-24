import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Map, {
  GeolocateControl,
  NavigationControl,
  type MapLayerMouseEvent,
  type MapRef,
  type StyleSpecification,
} from "react-map-gl/maplibre";
import { useLocation } from "react-router";
import { useApp } from "~/AppContext";
import { APP_CONSTANTS } from "~/config/constants";
import { DEFAULT_STYLE, loadStyle } from "~/maps/styleloader";

interface AppMapProps {
  children?: React.ReactNode;
  showTraffic?: boolean;
  showCameras?: boolean;
  syncState?: boolean;
  interactiveLayerIds?: string[];
  onClick?: (e: MapLayerMouseEvent) => void;
  initialViewState?: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  style?: React.CSSProperties;
  maxBounds?: [number, number, number, number] | null;
  attributionControl?: boolean | any;
  showNavigation?: boolean;
  showGeolocate?: boolean;
  onMove?: (e: any) => void;
  onDragStart?: () => void;
  onZoomStart?: () => void;
  onRotateStart?: () => void;
  onPitchStart?: () => void;
  onLoad?: () => void;
}

export const AppMap = forwardRef<MapRef, AppMapProps>(
  (
    {
      children,
      showTraffic: propShowTraffic,
      showCameras: propShowCameras,
      syncState = false,
      interactiveLayerIds,
      onClick,
      initialViewState,
      style,
      maxBounds = [
        (APP_CONSTANTS.bounds.sw as [number, number])[0],
        (APP_CONSTANTS.bounds.sw as [number, number])[1],
        (APP_CONSTANTS.bounds.ne as [number, number])[0],
        (APP_CONSTANTS.bounds.ne as [number, number])[1],
      ],
      attributionControl = false,
      showNavigation = false,
      showGeolocate = false,
      onMove,
      onDragStart,
      onZoomStart,
      onRotateStart,
      onPitchStart,
      onLoad,
    },
    ref
  ) => {
    const {
      theme,
      mapState,
      updateMapState,
      showTraffic: settingsShowTraffic,
      showCameras: settingsShowCameras,
      mapPositionMode,
    } = useApp();
    const mapRef = useRef<MapRef>(null);
    const [mapStyle, setMapStyle] = useState<StyleSpecification>(DEFAULT_STYLE);
    const location = useLocation();
    const path = location.pathname;

    // Use prop if provided, otherwise use settings
    const showTraffic =
      propShowTraffic !== undefined ? propShowTraffic : settingsShowTraffic;
    const showCameras =
      propShowCameras !== undefined ? propShowCameras : settingsShowCameras;

    useImperativeHandle(ref, () => mapRef.current!);

    useEffect(() => {
      loadStyle("openfreemap", theme, { includeTraffic: showTraffic })
        .then((style) => setMapStyle(style))
        .catch((error) => console.error("Failed to load map style:", error));
    }, [theme, showTraffic]);

    useEffect(() => {
      const handleMapChange = () => {
        if (!syncState || !mapRef.current) return;
        const map = mapRef.current.getMap();
        if (!map) return;
        const center = map.getCenter();
        const zoom = map.getZoom();
        updateMapState([center.lat, center.lng], zoom, path);
      };

      const handleStyleImageMissing = (e: any) => {
        if (!mapRef.current) return;
        const map = mapRef.current.getMap();
        if (!map || map.hasImage(e.id)) return;

        if (e.id.startsWith("stop-")) {
          console.warn(`Missing icon image: ${e.id}`);
        }

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
    }, [syncState, updateMapState]);

    const getLatitude = (center: any) =>
      Array.isArray(center) ? center[0] : center.lat;
    const getLongitude = (center: any) =>
      Array.isArray(center) ? center[1] : center.lng;

    const viewState = useMemo(() => {
      if (initialViewState) return initialViewState;

      if (mapPositionMode === "gps" && mapState.userLocation) {
        return {
          latitude: getLatitude(mapState.userLocation),
          longitude: getLongitude(mapState.userLocation),
          zoom: 16,
        };
      }

      const pathState = mapState.paths[path];
      if (pathState) {
        return {
          latitude: getLatitude(pathState.center),
          longitude: getLongitude(pathState.center),
          zoom: pathState.zoom,
        };
      }

      return {
        latitude: getLatitude(APP_CONSTANTS.defaultCenter),
        longitude: getLongitude(APP_CONSTANTS.defaultCenter),
        zoom: APP_CONSTANTS.defaultZoom,
      };
    }, [initialViewState, mapPositionMode, mapState, path]);

    return (
      <Map
        ref={mapRef}
        mapLib={maplibregl as any}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%", ...style }}
        initialViewState={viewState}
        maxBounds={maxBounds || undefined}
        attributionControl={attributionControl}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onClick}
        onMove={onMove}
        onDragStart={onDragStart}
        onZoomStart={onZoomStart}
        onRotateStart={onRotateStart}
        onPitchStart={onPitchStart}
        onLoad={onLoad}
        dragPan={{
          linearity: 0.4,
          deceleration: 3000,
        }}
      >
        {showNavigation && <NavigationControl position="bottom-right" />}
        {showGeolocate && (
          <GeolocateControl
            position="bottom-right"
            trackUserLocation={true}
            positionOptions={{ enableHighAccuracy: false }}
          />
        )}
        {children}
      </Map>
    );
  }
);

AppMap.displayName = "AppMap";
