import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { APP_CONFIG } from "~/config/AppConfig";

export type Theme = "light" | "dark" | "system";
export type TableStyle = "regular" | "grouped" | "experimental_consolidated";
export type MapPositionMode = "gps" | "last";

interface SettingsContextProps {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  toggleTheme: () => void;

  mapPositionMode: MapPositionMode;
  setMapPositionMode: (mode: MapPositionMode) => void;
  resolvedTheme: "light" | "dark";
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

  //#region Table Style
  const [tableStyle, setTableStyle] = useState<TableStyle>(() => {
    const savedTableStyle = localStorage.getItem("tableStyle");
    if (savedTableStyle) {
      return savedTableStyle as TableStyle;
    }
    return APP_CONFIG.defaultTableStyle;
  });

  const toggleTableStyle = () => {
    setTableStyle((prevTableStyle) =>
      prevTableStyle === "regular" ? "grouped" : "regular"
    );
  };

  useEffect(() => {
    localStorage.setItem("tableStyle", tableStyle);
  }, [tableStyle]);
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

  return (
    <SettingsContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        mapPositionMode,
        setMapPositionMode,
        resolvedTheme,
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
