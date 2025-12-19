import { CircleHelp, Eye, EyeClosed, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { ErrorDisplay } from "~/components/ErrorDisplay";
import LineIcon from "~/components/LineIcon";
import { PullToRefresh } from "~/components/PullToRefresh";
import { StopAlert } from "~/components/StopAlert";
import { StopHelpModal } from "~/components/StopHelpModal";
import { StopMapModal } from "~/components/StopMapModal";
import { ConsolidatedCirculationList } from "~/components/Stops/ConsolidatedCirculationList";
import { ConsolidatedCirculationListSkeleton } from "~/components/Stops/ConsolidatedCirculationListSkeleton";
import { APP_CONSTANTS } from "~/config/constants";
import { usePageTitle } from "~/contexts/PageTitleContext";
import { useAutoRefresh } from "~/hooks/useAutoRefresh";
import StopDataProvider, { type Stop } from "../data/StopDataProvider";
import "./stops-$id.css";

export interface ConsolidatedCirculation {
  line: string;
  route: string;
  schedule?: {
    running: boolean;
    minutes: number;
    serviceId: string;
    tripId: string;
    shapeId?: string;
  };
  realTime?: {
    minutes: number;
    distance: number;
  };
  currentPosition?: {
    latitude: number;
    longitude: number;
    orientationDegrees: number;
    shapeIndex?: number;
  };
  isPreviousTrip?: boolean;
  previousTripShapeId?: string;
  nextStreets?: string[];
}

export const getCirculationId = (c: ConsolidatedCirculation): string => {
  if (c.schedule?.tripId) {
    return `trip:${c.schedule.tripId}`;
  }
  return `rt:${c.line}:${c.route}:${c.realTime?.minutes ?? "?"}`;
};

interface ErrorInfo {
  type: "network" | "server" | "unknown";
  status?: number;
  message?: string;
}

const loadConsolidatedData = async (
  stopId: string
): Promise<ConsolidatedCirculation[]> => {
  const resp = await fetch(
    `${APP_CONSTANTS.consolidatedCirculationsEndpoint}?stopId=${stopId}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  return await resp.json();
};

export interface ConsolidatedCirculation {
  line: string;
  route: string;
  schedule?: {
    running: boolean;
    minutes: number;
    serviceId: string;
    tripId: string;
    shapeId?: string;
  };
  realTime?: {
    minutes: number;
    distance: number;
  };
  currentPosition?: {
    latitude: number;
    longitude: number;
    orientationDegrees: number;
    shapeIndex?: number;
  };
  isPreviousTrip?: boolean;
  previousTripShapeId?: string;
  nextStreets?: string[];
}

export default function Estimates() {
  const { t } = useTranslation();
  const params = useParams();
  const stopId = params.id ?? "";
  const [customName, setCustomName] = useState<string | undefined>(undefined);
  const [stopData, setStopData] = useState<Stop | undefined>(undefined);

  // Data state
  const [data, setData] = useState<ConsolidatedCirculation[] | null>(null);
  const [dataDate, setDataDate] = useState<Date | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<ErrorInfo | null>(null);

  const [favourited, setFavourited] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isReducedView, setIsReducedView] = useState(false);
  const [selectedCirculationId, setSelectedCirculationId] = useState<
    string | undefined
  >(undefined);

  // Helper function to get the display name for the stop
  const getStopDisplayName = useCallback(() => {
    if (customName) return customName;
    if (stopData?.name) return stopData.name;
    return `Parada ${stopId}`;
  }, [customName, stopData, stopId]);

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

      const body = await loadConsolidatedData(stopId);
      setData(body);
      setDataDate(new Date());

      // Load stop data from StopDataProvider
      const stop = await StopDataProvider.getStopById(stopId);
      setStopData(stop);
      setCustomName(StopDataProvider.getCustomName(stopId));
    } catch (error) {
      console.error("Error loading consolidated data:", error);
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

  useAutoRefresh({
    onRefresh: refreshData,
    interval: 18000,
    enabled: !dataError,
  });

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
        {stopData && stopData.lines && stopData.lines.length > 0 && (
          <div className={`estimates-lines-container scrollable`}>
            {stopData.lines.map((line) => (
              <div key={line} className="estimates-line-icon">
                <LineIcon line={line} mode="rounded" />
              </div>
            ))}
          </div>
        )}

        {stopData && <StopAlert stop={stopData} />}

        <div className="estimates-list-container">
          {dataLoading ? (
            <ConsolidatedCirculationListSkeleton />
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
                <div className="flex items-center gap-8">
                  <Star
                    className={`cursor-pointer transition-colors ${
                      favourited
                        ? "fill-[var(--star-color)] text-[var(--star-color)]"
                        : "text-slate-500"
                    }`}
                    onClick={toggleFavourite}
                  />

                  <CircleHelp
                    className="text-slate-500 cursor-pointer"
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
                      className="text-slate-500"
                      onClick={() => setIsReducedView(false)}
                    />
                  ) : (
                    <Eye
                      className="text-slate-500"
                      onClick={() => setIsReducedView(true)}
                    />
                  )}
                </div>
              </div>
              <ConsolidatedCirculationList
                data={data}
                reduced={isReducedView}
                driver={stopData?.stopId.split(":")[0]}
                onCirculationClick={(estimate, idx) => {
                  setSelectedCirculationId(getCirculationId(estimate));
                  setIsMapModalOpen(true);
                }}
              />
            </>
          ) : null}
        </div>

        {stopData && (
          <StopMapModal
            stop={stopData}
            circulations={(data ?? []).map((c) => ({
              id: getCirculationId(c),
              line: c.line,
              route: c.route,
              currentPosition: c.currentPosition,
              isPreviousTrip: c.isPreviousTrip,
              previousTripShapeId: c.previousTripShapeId,
              schedule: c.schedule
                ? {
                    shapeId: c.schedule.shapeId,
                  }
                : undefined,
            }))}
            isOpen={isMapModalOpen}
            onClose={() => setIsMapModalOpen(false)}
            selectedCirculationId={selectedCirculationId}
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
