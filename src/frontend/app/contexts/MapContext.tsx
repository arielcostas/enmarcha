import { type LngLatLike } from "maplibre-gl";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { APP_CONSTANTS } from "~/config/constants";

interface MapState {
  center: LngLatLike;
  zoom: number;
  userLocation: LngLatLike | null;
  hasLocationPermission: boolean;
}

interface MapContextProps {
  mapState: MapState;
  setMapCenter: (center: LngLatLike) => void;
  setMapZoom: (zoom: number) => void;
  setUserLocation: (location: LngLatLike | null) => void;
  setLocationPermission: (hasPermission: boolean) => void;
  updateMapState: (center: LngLatLike, zoom: number) => void;
}

const MapContext = createContext<MapContextProps | undefined>(undefined);

export const MapProvider = ({ children }: { children: ReactNode }) => {
  const [mapState, setMapState] = useState<MapState>(() => {
    const savedMapState = localStorage.getItem("mapState");
    if (savedMapState) {
      try {
        const parsed = JSON.parse(savedMapState);
        // Validate that the saved center is valid if needed, or just trust it.
        // We might want to ensure we have a fallback if the region changed while the app was closed?
        // But for now, let's stick to the existing logic.
        return {
          center: parsed.center || APP_CONSTANTS.defaultCenter,
          zoom: parsed.zoom || APP_CONSTANTS.defaultZoom,
          userLocation: parsed.userLocation || null,
          hasLocationPermission: parsed.hasLocationPermission || false,
        };
      } catch (e) {
        console.error("Error parsing saved map state", e);
      }
    }
    return {
      center: APP_CONSTANTS.defaultCenter,
      zoom: APP_CONSTANTS.defaultZoom,
      userLocation: null,
      hasLocationPermission: false,
    };
  });

  const setMapCenter = (center: LngLatLike) => {
    setMapState((prev) => {
      const newState = { ...prev, center };
      localStorage.setItem("mapState", JSON.stringify(newState));
      return newState;
    });
  };

  const setMapZoom = (zoom: number) => {
    setMapState((prev) => {
      const newState = { ...prev, zoom };
      localStorage.setItem("mapState", JSON.stringify(newState));
      return newState;
    });
  };

  const setUserLocation = (userLocation: LngLatLike | null) => {
    setMapState((prev) => {
      const newState = { ...prev, userLocation };
      localStorage.setItem("mapState", JSON.stringify(newState));
      return newState;
    });
  };

  const setLocationPermission = (hasLocationPermission: boolean) => {
    setMapState((prev) => {
      const newState = { ...prev, hasLocationPermission };
      localStorage.setItem("mapState", JSON.stringify(newState));
      return newState;
    });
  };

  const updateMapState = (center: LngLatLike, zoom: number) => {
    setMapState((prev) => {
      const newState = { ...prev, center, zoom };
      localStorage.setItem("mapState", JSON.stringify(newState));
      return newState;
    });
  };

  // Try to get user location on load if permission was granted
  useEffect(() => {
    if (mapState.hasLocationPermission && !mapState.userLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
          },
          (error) => {
            console.error("Error getting location:", error);
            setLocationPermission(false);
          }
        );
      }
    }
  }, [mapState.hasLocationPermission, mapState.userLocation]);

  return (
    <MapContext.Provider
      value={{
        mapState,
        setMapCenter,
        setMapZoom,
        setUserLocation,
        setLocationPermission,
        updateMapState,
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
