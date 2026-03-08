import { useQuery } from "@tanstack/react-query";
import { Clock, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { fetchArrivals } from "~/api/arrivals";
import { type Arrival } from "~/api/schema";
import { fetchRoutes } from "~/api/transit";
import RouteIcon from "~/components/RouteIcon";
import { usePageTitle } from "~/contexts/PageTitleContext";
import SpecialPlacesProvider, {
  type SpecialPlace,
} from "~/data/SpecialPlacesProvider";
import StopDataProvider, { type Stop } from "~/data/StopDataProvider";
import { useFavorites } from "~/hooks/useFavorites";

export default function Favourites() {
  const { t } = useTranslation();
  usePageTitle(t("favourites.title", "Favourites"));

  const [home, setHome] = useState<SpecialPlace | null>(null);
  const [work, setWork] = useState<SpecialPlace | null>(null);
  const [favouriteStops, setFavouriteStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgencies, setExpandedAgencies] = useState<
    Record<string, boolean>
  >({});
  const { favorites: favouriteRouteIds, isFavorite: isFavoriteRoute } =
    useFavorites("favouriteRoutes");
  const { favorites: favouriteAgencyIds, isFavorite: isFavoriteAgency } =
    useFavorites("favouriteAgencies");

  const orderedAgencies = [
    "vitrasa",
    "tranvias",
    "tussa",
    "ourense",
    "feve",
    "shuttle",
  ];

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["routes", "favourites"],
    queryFn: () => fetchRoutes(orderedAgencies),
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load special places
      setHome(SpecialPlacesProvider.getHome());
      setWork(SpecialPlacesProvider.getWork());

      // Load favourite stops
      const favouriteIds = StopDataProvider.getFavouriteIds();
      const stopsMap = await StopDataProvider.fetchStopsByIds(favouriteIds);
      const favStops = favouriteIds
        .map((id) => stopsMap[id])
        .filter(Boolean)
        .map((stop) => ({ ...stop, favourite: true }));
      setFavouriteStops(favStops);
    } catch (error) {
      console.error("Error loading favourites:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveFavourite = (stopId: string) => {
    StopDataProvider.removeFavourite(stopId);
    setFavouriteStops((prev) => prev.filter((s) => s.stopId !== stopId));
  };

  const handleRemoveHome = () => {
    SpecialPlacesProvider.removeHome();
    setHome(null);
  };

  const handleRemoveWork = () => {
    SpecialPlacesProvider.removeWork();
    setWork(null);
  };

  const toggleAgencyExpanded = (agency: string) => {
    setExpandedAgencies((prev) => ({ ...prev, [agency]: !prev[agency] }));
  };

  const favouriteRoutes = useMemo(() => {
    return routes.filter((route) => isFavoriteRoute(route.id));
  }, [routes, isFavoriteRoute]);

  const favouriteAgencies = useMemo(() => {
    return routes.reduce(
      (acc, route) => {
        const agency = route.agencyName || t("routes.unknown_agency", "Otros");
        if (!isFavoriteAgency(agency)) {
          return acc;
        }

        if (!acc[agency]) {
          acc[agency] = [];
        }

        acc[agency].push(route);
        return acc;
      },
      {} as Record<string, typeof routes>
    );
  }, [routes, isFavoriteAgency, t]);

  const sortedFavouriteAgencyEntries = useMemo(() => {
    return Object.entries(favouriteAgencies).sort(([a], [b]) => {
      const indexA = orderedAgencies.indexOf(a.toLowerCase());
      const indexB = orderedAgencies.indexOf(b.toLowerCase());

      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [favouriteAgencies]);

  const isEmpty =
    !home &&
    !work &&
    favouriteStops.length === 0 &&
    favouriteRouteIds.length === 0 &&
    favouriteAgencyIds.length === 0;

  if (loading || routesLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            {t("common.loading", "Loading...")}
          </div>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <svg
            className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t("favourites.empty", "You don't have any favourite stops yet.")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t(
              "favourites.empty_description",
              "Go to a stop and mark it as favourite to see it here."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 pb-8">
      {favouriteRoutes.length > 0 && (
        <div className="w-full px-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1 pl-1">
            <Star className="text-yellow-500 w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted m-0">
              {t("routes.favorites", "Rutas favoritas")}
            </h3>
          </div>
          <ul className="list-none p-0 m-0 flex flex-col gap-2 md:grid md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {favouriteRoutes.map((route) => (
              <li key={route.id}>
                <Link
                  to={`/routes/${route.id}`}
                  className="flex items-center gap-x-4 gap-y-3 rounded-xl p-3 transition-all bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.98] cursor-pointer"
                >
                  <RouteIcon
                    line={route.shortName ?? "?"}
                    mode="pill"
                    colour={route.color ?? "#6b7280"}
                    textColour={route.textColor ?? "#ffffff"}
                  />
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <p className="truncate text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                      {route.longName}
                    </p>
                    {route.agencyName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {route.agencyName}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Special Places Section */}
      {(home || work) && (
        <div className="w-full px-4 flex flex-col gap-2 pb-2">
          <div className="flex items-center gap-2 mb-1 pl-1">
            <Star className="text-yellow-500 w-4 h-4 opacity-70" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted m-0">
              {t("favourites.special_places", "Special Places")}
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {/* Home */}
            <SpecialPlaceCard
              icon="🏠"
              label={t("favourites.home", "Home")}
              place={home}
              onRemove={handleRemoveHome}
              editLabel={t("favourites.edit_home", "Edit Home")}
              removeLabel={t("favourites.remove_home", "Remove Home")}
              notSetLabel={t("favourites.not_set", "Not set")}
              setLabel={t("favourites.set_home", "Set Home")}
            />
            {/* Work */}
            <SpecialPlaceCard
              icon="💼"
              label={t("favourites.work", "Work")}
              place={work}
              onRemove={handleRemoveWork}
              editLabel={t("favourites.edit_work", "Edit Work")}
              removeLabel={t("favourites.remove_work", "Remove Work")}
              notSetLabel={t("favourites.not_set", "Not set")}
              setLabel={t("favourites.set_work", "Set Work")}
            />
          </div>
        </div>
      )}

      {/* Favourite Stops Section */}
      {favouriteStops.length > 0 && (
        <div className="w-full px-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1 pl-1">
            <Star className="text-yellow-500 w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted m-0">
              {t("favourites.favourite_stops", "Favourite Stops")}
            </h3>
          </div>
          <ul className="list-none p-0 m-0 flex flex-col gap-2 md:grid md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {favouriteStops.map((stop, index) => (
              <FavouriteStopItem
                key={stop.stopId}
                stop={stop}
                onRemove={handleRemoveFavourite}
                removeLabel={t("favourites.remove", "Remove")}
                viewLabel={t("favourites.view_estimates", "View estimates")}
                showArrivals={index < 3}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface SpecialPlaceCardProps {
  icon: string;
  label: string;
  place: SpecialPlace | null;
  onRemove: () => void;
  editLabel: string;
  removeLabel: string;
  notSetLabel: string;
  setLabel: string;
}

function SpecialPlaceCard({
  icon,
  label,
  place,
  onRemove,
  editLabel,
  removeLabel,
  notSetLabel,
  setLabel,
}: SpecialPlaceCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl" aria-hidden="true">
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text mb-1">{label}</h3>
            {place ? (
              <div className="text-sm text-muted">
                <p className="font-medium text-text">{place.name}</p>
                {place.type === "stop" && place.stopId && (
                  <p className="text-xs mt-1">({place.stopId})</p>
                )}
                {place.type === "address" && place.address && (
                  <p className="text-xs mt-1">{place.address}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {notSetLabel}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {place ? (
            <>
              {place.type === "stop" && place.stopId && (
                <Link
                  to={`/stops/${place.stopId}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  {editLabel}
                </Link>
              )}
              <button
                onClick={onRemove}
                className="text-xs text-red-600 dark:text-red-400 hover:underline whitespace-nowrap"
                type="button"
              >
                {removeLabel}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                // TODO: Open modal/dialog to set location
                console.log("Set location not implemented yet");
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              type="button"
            >
              {setLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FavouriteStopItemProps {
  stop: Stop;
  onRemove: (stopId: string) => void;
  removeLabel: string;
  viewLabel: string;
  showArrivals?: boolean;
}

function FavouriteStopItem({
  stop,
  onRemove,
  removeLabel,
  viewLabel: _viewLabel,
  showArrivals,
}: FavouriteStopItemProps) {
  const { t } = useTranslation();
  const [arrivals, setArrivals] = useState<Arrival[] | null>(null);

  useEffect(() => {
    let mounted = true;
    if (showArrivals) {
      fetchArrivals(stop.stopId, true)
        .then((res) => {
          if (mounted) {
            setArrivals(res.arrivals.slice(0, 3));
          }
        })
        .catch(console.error);
    }
    return () => {
      mounted = false;
    };
  }, [showArrivals, stop.stopId]);

  const confirmAndRemove = () => {
    const ok = window.confirm(
      t("favourites.confirm_remove", "Remove this favourite?")
    );
    if (!ok) return;
    onRemove(stop.stopId);
  };

  return (
    <li className="relative">
      <button
        onClick={confirmAndRemove}
        className="absolute right-3 top-3 z-10 rounded-full p-1 text-yellow-500 transition-colors hover:bg-yellow-500/10"
        type="button"
        aria-label={removeLabel}
        title={removeLabel}
      >
        <Star size={14} className="fill-current" />
      </button>

      <Link
        to={`/stops/${stop.stopId}`}
        className="flex items-center gap-x-4 gap-y-3 rounded-xl border border-gray-200 bg-slate-50 p-3 shadow-sm transition-all hover:border-blue-400 active:scale-[0.98] cursor-pointer dark:border-gray-700 dark:bg-slate-800 dark:hover:border-blue-500"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex justify-between items-start gap-2">
            <span className="pr-6 text-base font-bold overflow-hidden text-ellipsis line-clamp-2 leading-tight text-slate-900 dark:text-slate-100">
              {StopDataProvider.getDisplayName(stop)}
            </span>
          </div>

          <div className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono uppercase">
            <span className="px-1.5 py-0.5 rounded flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-none">
              {stop.stopId.split(":")[0]}
            </span>
            <span>
              {stop.stopCode || stop.stopId.split(":")[1] || stop.stopId}
            </span>
          </div>

          {stop.lines && stop.lines.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {stop.lines.map((lineObj) => (
                <RouteIcon
                  key={lineObj.line}
                  line={lineObj.line}
                  colour={lineObj.colour}
                  textColour={lineObj.textColour}
                />
              ))}
            </div>
          )}

          {showArrivals && arrivals && arrivals.length > 0 && (
            <div className="flex flex-col gap-1 mt-2 p-2 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 mb-1 opacity-70">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {t("estimates.next_arrivals", "Próximas llegadas")}
                </span>
              </div>
              {arrivals.map((arr, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="shrink-0">
                    <RouteIcon
                      line={arr.route.shortName}
                      colour={arr.route.colour}
                      textColour={arr.route.textColour}
                    />
                  </div>
                  <span className="flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                    {arr.headsign.destination}
                  </span>
                  <span
                    className={`text-xs pr-1 font-bold ${
                      arr.estimate.precision === "confident"
                        ? "text-green-600 dark:text-green-500"
                        : arr.estimate.precision === "unsure"
                          ? "text-orange-600 dark:text-orange-500"
                          : arr.estimate.precision === "past"
                            ? "text-gray-500 line-through"
                            : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {arr.estimate.minutes}&apos;
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
