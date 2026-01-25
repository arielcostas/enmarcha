import { History } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { PlannerOverlay } from "~/components/PlannerOverlay";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { usePlanner } from "~/hooks/usePlanner";
import StopGallery from "../components/StopGallery";
import StopItem from "../components/StopItem";
import StopDataProvider, { type Stop } from "../data/StopDataProvider";
import "../tailwind-full.css";

export default function StopList() {
  const { t } = useTranslation();
  usePageTitle(t("navbar.stops", "Paradas"));
  const navigate = useNavigate();
  const { history, searchRoute, loadRoute } = usePlanner({ autoLoad: false });
  const [data, setData] = useState<Stop[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Stop[] | null>(null);
  const [favouriteStops, setFavouriteStops] = useState<Stop[]>([]);
  const [recentStops, setRecentStops] = useState<Stop[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const randomPlaceholder = useMemo(
    () => t("stoplist.search_placeholder"),
    [t]
  );

  const requestUserLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn("Unable to obtain user location", error);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    let permissionStatus: PermissionStatus | null = null;

    const handlePermissionChange = () => {
      if (permissionStatus?.state === "granted") {
        requestUserLocation();
      }
    };

    const checkPermission = async () => {
      try {
        if (navigator.permissions?.query) {
          permissionStatus = await navigator.permissions.query({
            name: "geolocation",
          });
          if (permissionStatus.state === "granted") {
            requestUserLocation();
          }
          permissionStatus.addEventListener("change", handlePermissionChange);
        } else {
          requestUserLocation();
        }
      } catch (error) {
        console.warn("Geolocation permission check failed", error);
        requestUserLocation();
      }
    };

    checkPermission();

    return () => {
      permissionStatus?.removeEventListener("change", handlePermissionChange);
    };
  }, [requestUserLocation]);

  // Load stops from network
  const loadStops = useCallback(async () => {
    try {
      setLoading(true);

      const favouriteIds = StopDataProvider.getFavouriteIds();
      const recentIds = StopDataProvider.getRecent();
      const allIds = Array.from(new Set([...favouriteIds, ...recentIds]));

      const stopsMap = await StopDataProvider.fetchStopsByIds(allIds);

      const favStops = favouriteIds
        .map((id) => stopsMap[id])
        .filter(Boolean)
        .map((stop) => ({ ...stop, favourite: true }));
      setFavouriteStops(favStops);

      const recStops = recentIds
        .map((id) => stopsMap[id])
        .filter(Boolean)
        .map((stop) => ({
          ...stop,
          favourite: favouriteIds.includes(stop.stopId),
        }));
      setRecentStops(recStops);

      setData(Object.values(stopsMap));
    } catch (error) {
      console.error("Failed to load stops:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStops();
  }, [loadStops]);

  const handleStopSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const searchQuery = event.target.value || "";

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      if (searchQuery.length === 0) {
        setSearchResults(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/stops/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (response.ok) {
          const results = await response.json();
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      }
    }, 300);
  };

  return (
    <div className="flex flex-col gap-4 py-4 pb-8">
      {/* Planner Section */}
      <div className="w-full px-4">
        <details className="group bg-surface border border-slate-200 dark:border-slate-700 shadow-sm">
          <summary className="list-none cursor-pointer focus:outline-none">
            <div className="flex items-center justify-between p-3 rounded-xl group-open:mb-3 transition-all">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <span className="font-semibold text-text">
                  {t("planner.where_to", "¿A dónde quieres ir?")}
                </span>
              </div>
              <div className="text-muted group-open:rotate-180 transition-transform">
                ↓
              </div>
            </div>
          </summary>

          <PlannerOverlay
            inline
            forceExpanded
            cardBackground="bg-transparent"
            userLocation={userLocation}
            autoLoad={false}
            onSearch={(origin, destination, time, arriveBy) => {
              searchRoute(origin, destination, time, arriveBy);
            }}
            onNavigateToPlanner={() => navigate("/planner")}
          />
        </details>

        {history.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted px-1">
              {t("planner.recent_routes", "Rutas recientes")}
            </h4>
            <div className="flex flex-col gap-1">
              {history.map((route, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    loadRoute(route);
                    navigate("/planner");
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border hover:bg-surface/80 transition-colors text-left"
                >
                  <History className="w-4 h-4 text-muted shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-text truncate">
                      {route.destination.name}
                    </span>
                    <span className="text-xs text-muted truncate">
                      {t("planner.from_to", {
                        from: route.origin.name,
                        to: route.destination.name,
                      })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Section */}
      <div className="w-full px-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2 px-1">
          {t("stoplist.search_label", "Buscar paradas")}
        </h3>
        <input
          type="search"
          placeholder={randomPlaceholder}
          onChange={handleStopSearch}
          className="
            w-full px-4 py-2 text-sm
            border border-border rounded-xl
            bg-surface
            text-text
            placeholder:text-muted placeholder:opacity-80
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent
            transition-all duration-200
          "
        />
      </div>

      {/* Search Results */}
      {searchResults && searchResults.length > 0 ? (
        <div className="w-full px-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-text">
            {t("stoplist.search_results", "Resultados de la búsqueda")}
          </h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-2 md:grid md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {searchResults.map((stop: Stop) => (
              <StopItem key={stop.stopId} stop={stop} />
            ))}
          </ul>
        </div>
      ) : searchResults !== null ? (
        <div className="w-full px-4 flex flex-col gap-2">
          <p className="text-center text-gray-600 dark:text-gray-400 py-8">
            {t("stoplist.no_results", "No se encontraron resultados")}
          </p>
        </div>
      ) : (
        <>
          {/* Favourites Gallery */}
          {!loading && (
            <StopGallery
              stops={favouriteStops.sort((a, b) =>
                a.stopId.localeCompare(b.stopId)
              )}
              title={t("stoplist.favourites")}
              emptyMessage={t("stoplist.no_favourites")}
            />
          )}

          {/* Recent Stops Gallery - only show if no favourites */}
          {!loading && favouriteStops.length === 0 && (
            <StopGallery
              stops={recentStops.slice(0, 5)}
              title={t("stoplist.recents")}
            />
          )}

          {/*<ServiceAlerts />*/}
        </>
      )}
    </div>
  );
}
