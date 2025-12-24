import { useEffect } from "react";
import { useSettings } from "../contexts/SettingsContext";

export const ThemeColorManager = () => {
  const { resolvedTheme } = useSettings();

  useEffect(() => {
    const color = resolvedTheme === "dark" ? "#1A1B26" : "#F7F7FF";

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
  }, [resolvedTheme]);

  return null;
};
