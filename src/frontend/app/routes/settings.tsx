import { Computer, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { useApp, type Theme } from "../AppContext";
import "../tailwind-full.css";

export default function Settings() {
  const { t, i18n } = useTranslation();
  usePageTitle(t("navbar.settings", "Ajustes"));
  const {
    theme,
    setTheme,
    mapPositionMode,
    setMapPositionMode,
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
  } = useApp();

  const THEMES = [
    {
      value: "light" as Theme,
      label: t("about.theme_light", "Claro"),
      icon: Sun,
    },
    {
      value: "dark" as Theme,
      label: t("about.theme_dark", "Oscuro"),
      icon: Moon,
    },
    {
      value: "system" as Theme,
      label: t("about.theme_system", "Sistema"),
      icon: Computer,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Theme Selection */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-text">
          {t("about.theme", "Tema")}
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`
                p-4 sm:p-6 flex flex-col items-center justify-center gap-2
                rounded-lg border-2 transition-all duration-200
                hover:bg-surface/50
                focus:outline-none focus:ring focus:ring-primary/50
                ${
                  value === theme
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border text-muted"
                }
              `}
            >
              <Icon className="w-6 h-6" />
              <span className="text-sm sm:text-base">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Map Position Mode */}
      <section className="mb-8">
        <label
          htmlFor="mapPositionMode"
          className="block text-lg font-medium text-text mb-3"
        >
          {t("about.map_position_mode")}
        </label>
        <select
          id="mapPositionMode"
          className="
            w-full px-4 py-3 rounded-lg border border-border
            bg-surface
            text-text
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent
            transition-colors duration-200
          "
          value={mapPositionMode}
          onChange={(e) => setMapPositionMode(e.target.value as "gps" | "last")}
        >
          <option value="gps">{t("about.map_position_gps")}</option>
          <option value="last">{t("about.map_position_last")}</option>
        </select>
      </section>

      {/* Map Layers */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-text">
          {t("about.map_layers", "Capas del mapa")}
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface cursor-pointer hover:bg-surface/50 transition-colors">
            <span className="text-text font-medium">
              {t("about.show_traffic", "Mostrar tráfico")}
            </span>
            <input
              type="checkbox"
              checked={showTraffic}
              onChange={(e) => setShowTraffic(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50"
            />
          </label>
          <label className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface cursor-pointer hover:bg-surface/50 transition-colors">
            <span className="text-text font-medium">
              {t("about.show_cameras", "Mostrar cámaras")}
            </span>
            <input
              type="checkbox"
              checked={showCameras}
              onChange={(e) => setShowCameras(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50"
            />
          </label>

          <hr className="border-border" />
          <label className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface cursor-pointer hover:bg-surface/50 transition-colors">
            <span className="text-text font-medium">
              {t("about.show_stops_bus", "Mostrar paradas de autobús")}
            </span>
            <input
              type="checkbox"
              checked={showBusStops}
              onChange={(e) => setShowBusStops(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50"
            />
          </label>
          <label className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface cursor-pointer hover:bg-surface/50 transition-colors">
            <span className="text-text font-medium">
              {t(
                "about.show_stops_coach",
                "Mostrar paradas de autobús interurbano"
              )}
            </span>
            <input
              type="checkbox"
              checked={showCoachStops}
              onChange={(e) => setShowCoachStops(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50"
            />
          </label>
          <label className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface cursor-pointer hover:bg-surface/50 transition-colors">
            <span className="text-text font-medium">
              {t("about.show_stops_train", "Mostrar paradas de tren")}
            </span>
            <input
              type="checkbox"
              checked={showTrainStops}
              onChange={(e) => setShowTrainStops(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50"
            />
          </label>
        </div>
      </section>

      {/* Language Selection */}
      <section>
        <label
          htmlFor="language"
          className="block text-lg font-medium text-text mb-3"
        >
          {t("about.language", "Idioma")}
        </label>
        <select
          id="language"
          className="
            w-full px-4 py-3 rounded-lg border border-border
            bg-surface
            text-text
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent
            transition-colors duration-200
          "
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
        >
          <option value="es-ES">Español</option>
          <option value="gl-ES">Galego</option>
          <option value="en-GB">English</option>
        </select>
      </section>
    </div>
  );
}
