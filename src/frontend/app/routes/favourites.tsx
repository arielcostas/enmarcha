import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import LineIcon from "~/components/LineIcon";
import { usePageTitle } from "~/contexts/PageTitleContext";
import SpecialPlacesProvider, {
  type SpecialPlace,
} from "~/data/SpecialPlacesProvider";
import StopDataProvider, { type Stop } from "~/data/StopDataProvider";

export default function Favourites() {
  const { t } = useTranslation();
  usePageTitle(t("favourites.title", "Favourites"));

  const [home, setHome] = useState<SpecialPlace | null>(null);
  const [work, setWork] = useState<SpecialPlace | null>(null);
  const [favouriteStops, setFavouriteStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load special places
      setHome(SpecialPlacesProvider.getHome());
      setWork(SpecialPlacesProvider.getWork());

      // Load favourite stops
      const favouriteIds = StopDataProvider.getFavouriteIds();
      const allStops = await StopDataProvider.getStops();
      const favStops = allStops.filter((stop) =>
        favouriteIds.includes(stop.stopId)
      );
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

  const isEmpty = !home && !work && favouriteStops.length === 0;

  if (loading) {
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
    <div className="page-container pb-8">
      {/* Special Places Section */}
      {(home || work) && (
        <div className="px-4 pt-4 pb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t("favourites.special_places", "Special Places")}
          </h2>
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
        <div className="px-4 pt-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t("favourites.favourite_stops", "Favourite Stops")}
          </h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {favouriteStops.map((stop) => (
              <FavouriteStopItem
                key={stop.stopId}
                stop={stop}
                onRemove={handleRemoveFavourite}
                removeLabel={t("favourites.remove", "Remove")}
                viewLabel={t("favourites.view_estimates", "View estimates")}
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
            <h3 className="font-semibold text-text mb-1">
              {label}
            </h3>
            {place ? (
              <div className="text-sm text-muted">
                <p className="font-medium text-text">
                  {place.name}
                </p>
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
}

function FavouriteStopItem({
  stop,
  onRemove,
  removeLabel,
  viewLabel,
}: FavouriteStopItemProps) {
  const { t } = useTranslation();
  const confirmAndRemove = () => {
    const ok = window.confirm(
      t("favourites.confirm_remove", "Remove this favourite?")
    );
    if (!ok) return;
    onRemove(stop.stopId);
  };

  return (
    <li className="bg-surface border border-border rounded-lg">
      <div className="flex items-stretch justify-between gap-2">
        <Link
          to={`/stops/${stop.stopId}`}
          className="flex-1 min-w-0 p-3 no-underline hover:bg-surface/80 rounded-l-lg transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-500 text-base" aria-label="Favourite">
              ★
            </span>
            <span className="text-xs text-muted font-medium">
              ({stop.stopId})
            </span>
          </div>
          <div className="font-semibold text-text mb-2">
            {StopDataProvider.getDisplayName(stop)}
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            {stop.lines?.slice(0, 6).map((line) => (
              <LineIcon key={line} line={line} />
            ))}
            {stop.lines && stop.lines.length > 6 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                +{stop.lines.length - 6}
              </span>
            )}
          </div>
        </Link>
        <div className="flex items-center pr-3">
          <button
            onClick={confirmAndRemove}
            className="text-sm px-3 py-1 rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap"
            type="button"
            aria-label={removeLabel}
          >
            {removeLabel}
          </button>
        </div>
      </div>
    </li>
  );
}
