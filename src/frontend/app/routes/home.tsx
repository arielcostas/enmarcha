import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePageTitle } from "~/contexts/PageTitleContext";
import StopGallery from "../components/StopGallery";
import StopItem from "../components/StopItem";
import StopItemSkeleton from "../components/StopItemSkeleton";
import StopDataProvider, { type Stop } from "../data/StopDataProvider";
import "../tailwind-full.css";

export default function StopList() {
  const { t } = useTranslation();
  usePageTitle(t("navbar.stops", "Paradas"));
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

  const fuse = useMemo(
    () =>
      new Fuse(data || [], {
        threshold: 0.3,
        keys: ["name", "stopId"],
      }),
    [data]
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

  // Sort stops by proximity when we know where the user is located.
  const sortedAllStops = useMemo(() => {
    if (!data) {
      return [] as Stop[];
    }

    if (!userLocation) {
      return [...data].sort((a, b) => a.stopId.localeCompare(b.stopId));
    }

    const toRadians = (value: number) => (value * Math.PI) / 180;
    const getDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ) => {
      const R = 6371000; // meters
      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
          Math.cos(toRadians(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    return data
      .map((stop) => {
        if (
          typeof stop.latitude !== "number" ||
          typeof stop.longitude !== "number"
        ) {
          return { stop, distance: Number.POSITIVE_INFINITY };
        }

        const distance = getDistance(
          userLocation.latitude,
          userLocation.longitude,
          stop.latitude,
          stop.longitude
        );

        return { stop, distance };
      })
      .sort((a, b) => {
        if (a.distance === b.distance) {
          return a.stop.stopId.localeCompare(b.stop.stopId);
        }
        return a.distance - b.distance;
      })
      .map(({ stop }) => stop);
  }, [data, userLocation]);

  // Load stops from network
  const loadStops = useCallback(async () => {
    try {
      setLoading(true);

      const stops = await StopDataProvider.loadStopsFromNetwork();

      // Add favourite flags to stops
      const favouriteStopsIds = StopDataProvider.getFavouriteIds();
      const stopsWithFavourites = stops.map((stop) => ({
        ...stop,
        favourite: favouriteStopsIds.includes(stop.stopId),
      }));

      setData(stopsWithFavourites);

      // Update favourite and recent stops with full data
      const favStops = stopsWithFavourites.filter((stop) =>
        favouriteStopsIds.includes(stop.stopId)
      );
      setFavouriteStops(favStops);

      const recIds = StopDataProvider.getRecent();
      const recStops = recIds
        .map((id) => stopsWithFavourites.find((stop) => stop.stopId === id))
        .filter(Boolean) as Stop[];
      setRecentStops(recStops.reverse());
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

    searchTimeout.current = setTimeout(() => {
      if (searchQuery.length === 0) {
        setSearchResults(null);
        return;
      }

      if (!data) {
        console.error("No data available for search");
        return;
      }

      // Check if search query is a number (stop code search)
      const isNumericSearch = /^\d+$/.test(searchQuery.trim());

      let items: Stop[];
      if (isNumericSearch) {
        // Direct match for stop codes
        const stopId = searchQuery.trim();
        const exactMatch = data.filter(
          (stop) => stop.stopId === stopId || stop.stopId.endsWith(`:${stopId}`)
        );
        if (exactMatch.length > 0) {
          items = exactMatch;
        } else {
          // Fuzzy search if no exact match
          const results = fuse.search(searchQuery);
          items = results.map((result) => result.item);
        }
      } else {
        // Text search using Fuse.js
        const results = fuse.search(searchQuery);
        items = results.map((result) => result.item);
      }

      setSearchResults(items);
    }, 300);
  };

  return (
    <div className="flex flex-col gap-4 py-4 pb-8">
      {/* Search Section */}
      <div className="w-full px-4">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
          {t("stoplist.search_label", "Buscar paradas")}
        </h3>
        <input
          type="search"
          placeholder={randomPlaceholder}
          onChange={handleStopSearch}
          className="
            w-full px-4 py-3 text-base
            border border-gray-300 dark:border-gray-700 rounded-xl
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder:text-gray-500 dark:placeholder:text-gray-400 placeholder:opacity-80
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-all duration-200
          "
        />
      </div>

      {/* Search Results */}
      {searchResults && searchResults.length > 0 ? (
        <div className="w-full px-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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

          {/* All Stops / Nearby Stops */}
          <div className="w-full px-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {userLocation && (
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {userLocation
                  ? t("stoplist.nearby_stops", "Nearby stops")
                  : t("stoplist.all_stops", "Paradas")}
              </h2>
            </div>

            <ul className="list-none p-0 m-0 flex flex-col gap-2 md:grid md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
              {loading && (
                <>
                  {Array.from({ length: 6 }, (_, index) => (
                    <StopItemSkeleton key={`skeleton-${index}`} />
                  ))}
                </>
              )}
              {!loading && data
                ? (userLocation
                    ? sortedAllStops.slice(0, 6)
                    : sortedAllStops
                  ).map((stop) => <StopItem key={stop.stopId} stop={stop} />)
                : null}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
