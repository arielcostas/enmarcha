import { CircleHelp, Eye, EyeClosed, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "react-router";
import { fetchArrivals } from "~/api/arrivals";
import {
  type Arrival,
  type Position,
  type RouteInfo,
  type StopArrivalsResponse,
} from "~/api/schema";
import { ArrivalList } from "~/components/arrivals/ArrivalList";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import { PullToRefresh } from "~/components/PullToRefresh";
import RouteIcon from "~/components/RouteIcon";
import ServiceAlerts from "~/components/ServiceAlerts";
import { StopHelpModal } from "~/components/stop/StopHelpModal";
import { StopMapModal } from "~/components/stop/StopMapModal";
import { StopUsageChart } from "~/components/stop/StopUsageChart";
import { useJourney } from "~/contexts/JourneyContext";
import { usePageRightNode, usePageTitle } from "~/contexts/PageTitleContext";
import { formatHex } from "~/utils/colours";
import StopDataProvider from "../data/StopDataProvider";
import "../tailwind-full.css";
import "./stops-$id.css";

function StopFavouriteButton({ stopId }: { stopId: string }) {
  const { t } = useTranslation();
  const [favourited, setFavourited] = useState(() =>
    StopDataProvider.isFavourite(stopId)
  );

  const toggle = () => {
    if (favourited) {
      StopDataProvider.removeFavourite(stopId);
      setFavourited(false);
    } else {
      StopDataProvider.addFavourite(stopId);
      setFavourited(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className={`app-header__menu-btn p-2 rounded-full transition-colors ${
        favourited
          ? "text-(--star-color)"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
      aria-label={t("stop.toggle_favourite", "Alternar favorito")}
    >
      <Star className={favourited ? "fill-current" : ""} size={24} />
    </button>
  );
}

export const getArrivalId = (a: Arrival): string => {
  return a.tripId;
};

interface ErrorInfo {
  type: "network" | "server" | "unknown";
  status?: number;
  message?: string;
}

export default function Estimates() {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const stopId = params.id ?? "";
  const stopFeedId = stopId.split(":")[0] || stopId;
  const fallbackStopCode = stopId.split(":")[1] || stopId;
  const [stopName, setStopName] = useState<string | undefined>(undefined);
  const [apiRoutes, setApiRoutes] = useState<RouteInfo[]>([]);
  const [apiLocation, setApiLocation] = useState<Position | undefined>(
    undefined
  );

  // Data state
  const [data, setData] = useState<StopArrivalsResponse | null>(null);
  const [dataDate, setDataDate] = useState<Date | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<ErrorInfo | null>(null);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isReducedView, setIsReducedView] = useState(false);
  const [selectedArrivalId, setSelectedArrivalId] = useState<
    string | undefined
  >(undefined);

  // Journey tracking
  const { activeJourney, startJourney, stopJourney } = useJourney();
  const trackedTripId =
    activeJourney?.stopId === stopId ? activeJourney.tripId : undefined;

  // If navigated from the journey banner, open the map for the tracked trip.
  // Empty dependency array is intentional: we only consume the navigation state
  // once on mount (location.state is fixed for the lifetime of this component
  // instance; setters from useState are stable and don't need to be listed).
  useEffect(() => {
    const state = location.state as
      | { openMap?: boolean; selectedTripId?: string }
      | null
      | undefined;
    if (state?.openMap && state?.selectedTripId) {
      setSelectedArrivalId(state.selectedTripId);
      setIsMapModalOpen(true);
    }
  }, []); // mount-only: see comment above

  const handleTrackArrival = useCallback(
    (arrival: Arrival) => {
      if (activeJourney?.tripId === arrival.tripId) {
        stopJourney();
        return;
      }
      startJourney({
        tripId: arrival.tripId,
        stopId,
        stopName: stopName ?? stopId,
        routeShortName: arrival.route.shortName,
        routeColour: arrival.route.colour,
        routeTextColour: arrival.route.textColour,
        headsignDestination: arrival.headsign.destination,
        initialMinutes: arrival.estimate.minutes,
        notifyAtMinutes: 2,
      });
    },
    [activeJourney, startJourney, stopJourney, stopId, stopName]
  );

  // Helper function to get the display name for the stop
  const getStopDisplayName = useCallback(() => {
    if (stopName) return stopName;
    return `Parada ${stopId}`;
  }, [stopId, stopName]);

  usePageTitle(getStopDisplayName());

  const rightNode = useMemo(
    () => <StopFavouriteButton stopId={stopId} />,
    [stopId]
  );
  usePageRightNode(rightNode);

  const parseError = (error: any): ErrorInfo => {
    if (!navigator.onLine) {
      return { type: "network", message: "No internet connection" };
    }

    if (
      error.message?.includes("Failed to fetch") ||
      error.message?.includes("NetworkError")
    ) {
      return { type: "network" };
    }

    if (error.message?.includes("HTTP")) {
      const statusMatch = error.message.match(/HTTP (\d+):/);
      const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
      return { type: "server", status };
    }

    return { type: "unknown", message: error.message };
  };

  const loadData = useCallback(async () => {
    try {
      setDataError(null);

      const response = await fetchArrivals(stopId, false);
      setData(response);
      setStopName(response.stopName);
      setApiRoutes(response.routes);
      if (response.stopLocation) {
        setApiLocation(response.stopLocation);
      }
      setDataDate(new Date());
    } catch (error) {
      console.error("Error loading arrivals data:", error);
      setDataError(parseError(error));
      setData(null);
      setDataDate(null);
    }
  }, [stopId]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadData()]);
  }, [loadData]);

  const handleManualRefresh = useCallback(async () => {
    try {
      setDataLoading(true);
      setIsManualRefreshing(true);
      await refreshData();
    } finally {
      setIsManualRefreshing(false);
      setDataLoading(false);
    }
  }, [refreshData]);

  useEffect(() => {
    // Initial load
    setDataLoading(true);
    loadData();

    StopDataProvider.pushRecent(stopId);
    setDataLoading(false);
  }, [stopId, loadData]);

  return (
    <PullToRefresh onRefresh={handleManualRefresh}>
      <div className="page-container stops-page flex-1">
        {apiRoutes.length > 0 && (
          <div className={`estimates-lines-container scrollable`}>
            {apiRoutes.map((line) => (
              <div key={line.shortName} className="estimates-line-icon">
                <RouteIcon
                  line={line.shortName}
                  colour={line.colour}
                  textColour={line.textColour}
                  mode="pill"
                />
              </div>
            ))}
          </div>
        )}

        <ServiceAlerts selectorFilter={[`stop#${stopId}`]} />

        <div className="estimates-list-container flex-1">
          {dataLoading ? (
            <>{/*TODO: New loading skeleton*/}</>
          ) : dataError ? (
            <ErrorDisplay
              error={dataError}
              onRetry={loadData}
              title={t(
                "errors.estimates_title",
                "Error al cargar estimaciones"
              )}
            />
          ) : data ? (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="consolidated-circulation-caption m-0 text-xs font-bold uppercase tracking-wider text-muted">
                      {t("estimates.caption", "Estimaciones a las {{time}}", {
                        time: dataDate?.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-muted">
                      <span className="flex items-center justify-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {stopFeedId}
                      </span>
                      <span>{data.stopCode || fallbackStopCode}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-muted"
                      onClick={() => setIsHelpModalOpen(true)}
                    >
                      <CircleHelp className="w-5 h-5" />
                    </button>
                    {isReducedView ? (
                      <button
                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-muted"
                        onClick={() => setIsReducedView(false)}
                      >
                        <EyeClosed className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-muted"
                        onClick={() => setIsReducedView(true)}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <ArrivalList
                arrivals={data.arrivals}
                reduced={isReducedView}
                onArrivalClick={(arrival) => {
                  setSelectedArrivalId(getArrivalId(arrival));
                  setIsMapModalOpen(true);
                }}
                onTrackArrival={handleTrackArrival}
                trackedTripId={trackedTripId}
              />

              {data.usage && data.usage.length > 0 && (
                <div className="mt-8">
                  <StopUsageChart usage={data.usage} />
                </div>
              )}
            </>
          ) : null}
        </div>

        {apiLocation && (
          <StopMapModal
            stop={{
              stopId: stopId,
              name: stopName ?? "",
              latitude: apiLocation?.latitude,
              longitude: apiLocation?.longitude,
              lines: [],
            }}
            circulations={(data?.arrivals ?? []).map((a) => ({
              id: getArrivalId(a),
              currentPosition: a.currentPosition ?? undefined,
              colour: formatHex(a.route.colour),
              textColour: formatHex(a.route.textColour),
              shape: a.shape,
            }))}
            isOpen={isMapModalOpen}
            onClose={() => setIsMapModalOpen(false)}
            selectedCirculationId={selectedArrivalId}
          />
        )}

        <StopHelpModal
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
        />
      </div>
    </PullToRefresh>
  );
}
