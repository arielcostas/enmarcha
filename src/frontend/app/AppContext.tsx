/* eslint-disable react-refresh/only-export-components */
import { type ReactNode } from "react";
import { type RegionId } from "./config/constants";
import { MapProvider, useMap } from "./contexts/MapContext";
import {
  SettingsProvider,
  useSettings,
  type MapPositionMode,
  type TableStyle,
  type Theme,
} from "./contexts/SettingsContext";

// Re-export types for compatibility
export type { MapPositionMode, RegionId, TableStyle, Theme };

// Combined hook for backward compatibility
export const useApp = () => {
  const settings = useSettings();
  const map = useMap();

  return {
    ...settings,
    ...map,
    // Mock region support for now since we only have one region
    region: "vigo" as RegionId,
    setRegion: (region: RegionId) => {
      console.log("Set region", region);
    },
  };
};

// Wrapper provider
export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <SettingsProvider>
      <MapProvider>{children}</MapProvider>
    </SettingsProvider>
  );
};
