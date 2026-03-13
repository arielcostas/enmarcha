import { useCallback } from "react";
import { useMap } from "../contexts/MapContext";
import type { LngLatLike } from "maplibre-gl";

export interface UseGeolocationResult {
  userLocation: { latitude: number; longitude: number } | null;
  hasLocationPermission: boolean;
  requestLocation: () => void;
}

function lngLatToCoords(
  loc: LngLatLike
): { latitude: number; longitude: number } {
  if (Array.isArray(loc)) {
    // This codebase stores location as [latitude, longitude] (not the standard
    // MapLibre [lng, lat] GeoJSON order). See MapContext.tsx where arrays are
    // set as [position.coords.latitude, position.coords.longitude], and AppMap.tsx
    // where getLatitude(center) returns center[0].
    return { latitude: loc[0], longitude: loc[1] };
  }
  if ("lat" in loc) {
    return {
      latitude: loc.lat,
      longitude: "lng" in loc ? (loc as any).lng : (loc as any).lon,
    };
  }
  return { latitude: 0, longitude: 0 };
}

/**
 * Provides the current user location from the global MapContext.
 * Location updates are driven by the MapContext's watchPosition subscription
 * (started automatically when geolocation permission is granted).
 *
 * Call `requestLocation()` to prompt the user for permission and start tracking.
 */
export function useGeolocation(): UseGeolocationResult {
  const { mapState, setUserLocation, setLocationPermission } = useMap();

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationPermission(true);
      },
      () => {
        setLocationPermission(false);
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
    );
  }, [setUserLocation, setLocationPermission]);

  const rawLoc = mapState.userLocation;
  const userLocation = rawLoc ? lngLatToCoords(rawLoc) : null;

  return {
    userLocation,
    hasLocationPermission: mapState.hasLocationPermission,
    requestLocation,
  };
}
