import { Home, Map, Route } from "lucide-react";
import type { LngLatLike } from "maplibre-gl";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { usePlanner } from "~/hooks/usePlanner";
import { useApp } from "../../AppContext";
import styles from "./NavBar.module.css";

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
            updateMapState(coords, 16, "gps");
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
      name: t("navbar.routes", "Rutas"),
      icon: Route,
      path: "/routes",
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
