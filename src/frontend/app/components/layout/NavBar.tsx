import { Home, Map, Route } from "lucide-react";
import type { LngLatLike } from "maplibre-gl";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { usePlanner } from "~/hooks/usePlanner";
import { useApp } from "../../AppContext";
import styles from "./NavBar.module.css";

// Helper: check if coordinates are within Vigo bounds
function isWithinVigo(lngLat: LngLatLike): boolean {
  let lng: number, lat: number;
  if (Array.isArray(lngLat)) {
    [lng, lat] = lngLat;
  } else if ("lng" in lngLat && "lat" in lngLat) {
    lng = lngLat.lng;
    lat = lngLat.lat;
  } else {
    return false;
  }
  // Rough bounding box for Vigo
  return lat >= 42.18 && lat <= 42.3 && lng >= -8.78 && lng <= -8.65;
}

interface NavBarProps {
  orientation?: "horizontal" | "vertical";
}

export default function NavBar({ orientation = "horizontal" }: NavBarProps) {
  const { t } = useTranslation();
  const { mapState, updateMapState, mapPositionMode } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { deselectItinerary } = usePlanner({ autoLoad: false });

  const navItems = [
    {
      name: t("navbar.home", "Paradas"),
      icon: Home,
      path: "/",
      exact: true,
    },
    {
      name: t("navbar.map", "Mapa"),
      icon: Map,
      path: "/map",
      callback: () => {
        if (mapPositionMode !== "gps") {
          return;
        }

        if (!("geolocation" in navigator)) {
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const coords: LngLatLike = [latitude, longitude];
            if (isWithinVigo(coords)) {
              updateMapState(coords, 16);
            }
          },
          () => {},
          {
            enableHighAccuracy: false,
            maximumAge: 5 * 60 * 1000,
            timeout: 10 * 1000,
          }
        );
      },
    },
    {
      name: t("navbar.lines", "Líneas"),
      icon: Route,
      path: "/lines",
    },
  ];

  return (
    <nav
      className={`${styles.navBar} ${
        orientation === "vertical" ? styles.vertical : ""
      }`}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);

        return (
          <Link
            key={item.name}
            to={item.path}
            className={`${styles.link} ${isActive ? styles.active : ""}${item.path === "/planner" ? " planner-nav-link" : ""}`}
            onClick={(e) => {
              if (
                item.path === "/planner" &&
                location.pathname === "/planner"
              ) {
                deselectItinerary();
                window.location.reload();
              } else if (item.callback) {
                item.callback();
              }
            }}
            title={item.name}
            aria-label={item.name}
          >
            <div className={styles.iconWrapper}>
              <Icon size={24} />
            </div>
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
