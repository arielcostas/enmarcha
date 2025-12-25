import { CircleHelp, Eye, EyeClosed, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { fetchArrivals } from "~/api/arrivals";
import { type Arrival, type Position, type RouteInfo } from "~/api/schema";
import { ArrivalList } from "~/components/arrivals/ArrivalList";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import LineIcon from "~/components/LineIcon";
import { PullToRefresh } from "~/components/PullToRefresh";
import { StopHelpModal } from "~/components/stop/StopHelpModal";
import { StopMapModal } from "~/components/stop/StopMapModal";
import { usePageTitle } from "~/contexts/PageTitleContext";
import StopDataProvider from "../data/StopDataProvider";
import "./stops-$id.css";

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
  const stopId = params.id ?? "";
  const [stopName, setStopName] = useState<string | undefined>(undefined);
  const [apiRoutes, setApiRoutes] = useState<RouteInfo[]>([]);
  const [apiLocation, setApiLocation] = useState<Position | undefined>(
    undefined
  );

  // Data state
  const [data, setData] = useState<Arrival[] | null>(null);
  const [dataDate, setDataDate] = useState<Date | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<ErrorInfo | null>(null);

  const [favourited, setFavourited] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isReducedView, setIsReducedView] = useState(false);
  const [selectedArrivalId, setSelectedArrivalId] = useState<
    string | undefined
  >(undefined);

  // Helper function to get the display name for the stop
  const getStopDisplayName = useCallback(() => {
    if (stopName) return stopName;
    return `Parada ${stopId}`;
  }, [stopId, stopName]);

  usePageTitle(getStopDisplayName());

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
      setData(response.arrivals);
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
    setFavourited(StopDataProvider.isFavourite(stopId));
    setDataLoading(false);
  }, [stopId, loadData]);

  const toggleFavourite = () => {
    if (favourited) {
      StopDataProvider.removeFavourite(stopId);
      setFavourited(false);
    } else {
      StopDataProvider.addFavourite(stopId);
      setFavourited(true);
    }
  };

  return (
    <PullToRefresh onRefresh={handleManualRefresh}>
      <div className="page-container stops-page">
        {apiRoutes.length > 0 && (
          <div className={`estimates-lines-container scrollable`}>
            {apiRoutes.map((line) => (
              <div key={line.shortName} className="estimates-line-icon">
                <LineIcon
                  line={line.shortName}
                  colour={line.colour}
                  textColour={line.textColour}
                  mode="pill"
                />
              </div>
            ))}
          </div>
        )}

        {/*{stopData && <StopAlert stop={stopData} />}*/}

        <div className="estimates-list-container">
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
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-4">
                  <Star
                    className={`cursor-pointer transition-colors ${
                      favourited
                        ? "fill-[var(--star-color)] text-[var(--star-color)]"
                        : "text-muted"
                    }`}
                    onClick={toggleFavourite}
                  />

                  <CircleHelp
                    className="text-muted cursor-pointer"
                    onClick={() => setIsHelpModalOpen(true)}
                  />
                </div>

                <div className="consolidated-circulation-caption">
                  {t(
                    "estimates.caption",
                    "Estimaciones de llegadas a las {{time}}",
                    {
                      time: dataDate?.toLocaleTimeString(),
                    }
                  )}
                </div>

                <div>
                  {isReducedView ? (
                    <EyeClosed
                      className="text-muted"
                      onClick={() => setIsReducedView(false)}
                    />
                  ) : (
                    <Eye
                      className="text-muted"
                      onClick={() => setIsReducedView(true)}
                    />
                  )}
                </div>
              </div>
              <ArrivalList
                arrivals={data}
                reduced={isReducedView}
                onArrivalClick={(arrival) => {
                  setSelectedArrivalId(getArrivalId(arrival));
                  setIsMapModalOpen(true);
                }}
              />
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
            circulations={(data ?? []).map((a) => ({
              id: getArrivalId(a),
              line: a.route.shortName,
              route: a.headsign.destination,
              currentPosition: a.currentPosition ?? undefined,
              stopShapeIndex: a.stopShapeIndex ?? undefined,
              schedule: {
                shapeId: undefined,
              },
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
