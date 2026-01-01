import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { APP_CONFIG } from "../config/AppConfig";

export type Theme = "light" | "dark" | "system";
export type MapPositionMode = "gps" | "last";

interface SettingsContextProps {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  toggleTheme: () => void;

  mapPositionMode: MapPositionMode;
  setMapPositionMode: (mode: MapPositionMode) => void;
  resolvedTheme: "light" | "dark";

  showTraffic: boolean;
  setShowTraffic: (show: boolean) => void;
  showCameras: boolean;
  setShowCameras: (show: boolean) => void;

  showBusStops: boolean;
  setShowBusStops: (show: boolean) => void;
  showCoachStops: boolean;
  setShowCoachStops: (show: boolean) => void;
  showTrainStops: boolean;
  setShowTrainStops: (show: boolean) => void;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(
  undefined
);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  //#region Theme
  const getPreferredScheme = () => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return "light" as const;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(
    getPreferredScheme
  );

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme");
    if (
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "system"
    ) {
      return savedTheme;
    }
    return APP_CONFIG.defaultTheme;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    // Sync immediately in case theme changed before subscription
    setSystemTheme(media.matches ? "dark" : "light");

    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      if (prevTheme === "light") {
        return "dark";
      }
      if (prevTheme === "dark") {
        return "system";
      }
      return "light";
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);
  //#endregion

  //#region Map Position Mode
  const [mapPositionMode, setMapPositionMode] = useState<MapPositionMode>(
    () => {
      const saved = localStorage.getItem("mapPositionMode");
      return saved === "last" || saved === "gps"
        ? (saved as MapPositionMode)
        : APP_CONFIG.defaultMapPositionMode;
    }
  );

  useEffect(() => {
    localStorage.setItem("mapPositionMode", mapPositionMode);
  }, [mapPositionMode]);
  //#endregion

  //#region Map Layers
  const [showTraffic, setShowTraffic] = useState<boolean>(() => {
    const saved = localStorage.getItem("showTraffic");
    return saved !== null ? saved === "true" : true;
  });

  const [showCameras, setShowCameras] = useState<boolean>(() => {
    const saved = localStorage.getItem("showCameras");
    return saved !== null ? saved === "true" : false;
  });

  useEffect(() => {
    localStorage.setItem("showTraffic", showTraffic.toString());
  }, [showTraffic]);

  useEffect(() => {
    localStorage.setItem("showCameras", showCameras.toString());
  }, [showCameras]);

  const [showBusStops, setShowBusStops] = useState<boolean>(() => {
    const saved = localStorage.getItem("stopsLayers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.bus ?? true;
      } catch {
        return true;
      }
    }
    return true;
  });

  const [showCoachStops, setShowCoachStops] = useState<boolean>(() => {
    const saved = localStorage.getItem("stopsLayers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.coach ?? true;
      } catch {
        return true;
      }
    }
    return true;
  });

  const [showTrainStops, setShowTrainStops] = useState<boolean>(() => {
    const saved = localStorage.getItem("stopsLayers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.train ?? true;
      } catch {
        return true;
      }
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem(
      "stopsLayers",
      JSON.stringify({
        bus: showBusStops,
        coach: showCoachStops,
        train: showTrainStops,
      })
    );
  }, [showBusStops, showCoachStops, showTrainStops]);
  //#endregion

  return (
    <SettingsContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        mapPositionMode,
        setMapPositionMode,
        resolvedTheme,
        showTraffic,
        setShowTraffic,
        showCameras,
        setShowCameras,

        showBusStops,
        setShowBusStops,
        showCoachStops,
        setShowCoachStops,
        showTrainStops,
        setShowTrainStops,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
