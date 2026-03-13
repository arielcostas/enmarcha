import { type LngLatLike } from "maplibre-gl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface MapState {
  paths: Record<string, { center: LngLatLike; zoom: number }>;
  userLocation: LngLatLike | null;
  hasLocationPermission: boolean;
}

interface MapContextProps {
  mapState: MapState;
  setUserLocation: (location: LngLatLike | null) => void;
  setLocationPermission: (hasPermission: boolean) => void;
  updateMapState: (center: LngLatLike, zoom: number, path: string) => void;
  requestLocation: () => void;
}

const MapContext = createContext<MapContextProps | undefined>(undefined);

export const MapProvider = ({ children }: { children: ReactNode }) => {
  const [mapState, setMapState] = useState<MapState>(() => {
    const savedMapState = localStorage.getItem("mapState");
    if (savedMapState) {
      try {
        const parsed = JSON.parse(savedMapState);
        return {
          paths: parsed.paths || {},
          userLocation: parsed.userLocation || null,
          hasLocationPermission: parsed.hasLocationPermission || false,
        };
      } catch (e) {
        console.error("Error parsing saved map state", e);
      }
    }
    return {
      paths: {},
      userLocation: null,
      hasLocationPermission: false,
    };
  });

  const watchIdRef = useRef<number | null>(null);

  const setUserLocation = useCallback((userLocation: LngLatLike | null) => {
    setMapState((prev) => {
      const newState = { ...prev, userLocation };
      localStorage.setItem("mapState", JSON.stringify(newState));
      return newState;
    });
  }, []);

  const setLocationPermission = useCallback(
    (hasLocationPermission: boolean) => {
      setMapState((prev) => {
        const newState = { ...prev, hasLocationPermission };
        localStorage.setItem("mapState", JSON.stringify(newState));
        return newState;
      });
    },
    []
  );

  const updateMapState = useCallback(
    (center: LngLatLike, zoom: number, path: string) => {
      setMapState((prev) => {
        const newState = {
          ...prev,
          paths: {
            ...prev.paths,
            [path]: { center, zoom },
          },
        };
        localStorage.setItem("mapState", JSON.stringify(newState));
        return newState;
      });
    },
    []
  );

  const startWatching = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setLocationPermission(true);
      },
      (error) => {
        if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
          setLocationPermission(false);
        }
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
    );
  }, [setUserLocation, setLocationPermission]);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationPermission(true);
        startWatching();
      },
      () => {
        setLocationPermission(false);
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
    );
  }, [setUserLocation, setLocationPermission, startWatching]);

  const hasPermissionRef = useRef(mapState.hasLocationPermission);

  // On mount: subscribe to permission changes and auto-start watching if already granted
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let permissionStatus: PermissionStatus | null = null;

    const onPermChange = () => {
      if (permissionStatus?.state === "granted") {
        setLocationPermission(true);
        startWatching();
      } else if (permissionStatus?.state === "denied") {
        setLocationPermission(false);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      }
    };

    const init = async () => {
      try {
        if (navigator.permissions?.query) {
          permissionStatus = await navigator.permissions.query({
            name: "geolocation",
          });
          if (permissionStatus.state === "granted") {
            setLocationPermission(true);
            startWatching();
          } else if (permissionStatus.state === "denied") {
            setLocationPermission(false);
          }
          permissionStatus.addEventListener("change", onPermChange);
        } else if (hasPermissionRef.current) {
          startWatching();
        }
      } catch {
        if (hasPermissionRef.current) {
          startWatching();
        }
      }
    };

    init();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      permissionStatus?.removeEventListener("change", onPermChange);
    };
  }, [startWatching, setLocationPermission]);

  return (
    <MapContext.Provider
      value={{
        mapState,
        setUserLocation,
        setLocationPermission,
        updateMapState,
        requestLocation,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};
