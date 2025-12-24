/* eslint-disable react-refresh/only-export-components */
import { type ReactNode } from "react";
import { MapProvider, useMap } from "./contexts/MapContext";
import {
  SettingsProvider,
  useSettings,
  type MapPositionMode,
  type Theme,
} from "./contexts/SettingsContext";

// Re-export types for compatibility
export type { MapPositionMode, Theme };

// Combined hook for backward compatibility
export const useApp = () => {
  const settings = useSettings();
  const map = useMap();

  return {
    ...settings,
    ...map,
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
