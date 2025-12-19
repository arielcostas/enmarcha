import { RefreshCw } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "react-modal-sheet";
import { Link } from "react-router";
import { ConsolidatedCirculationList } from "~/components/Stops/ConsolidatedCirculationList";
import { APP_CONSTANTS } from "~/config/constants";
import { type ConsolidatedCirculation } from "../../routes/stops-$id";
import { ErrorDisplay } from "../ErrorDisplay";
import LineIcon from "../LineIcon";
import "./StopSummarySheet.css";
import { StopSummarySheetSkeleton } from "./StopSummarySheetSkeleton";

export interface StopSheetProps {
  isOpen: boolean;
  onClose: () => void;
  stop: {
    stopId: string;
    stopCode?: string;
    stopFeed?: string;
    name: string;
    lines: {
      line: string;
      colour?: string;
      textColour?: string;
    }[];
  };
}

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

export const StopSheet: React.FC<StopSheetProps> = ({
  isOpen,
  onClose,
  stop,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<ConsolidatedCirculation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      const stopData = await loadConsolidatedData(stop.stopId);
      setData(stopData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load stop data:", err);
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && stop.stopId) {
      loadData();
    }
  }, [isOpen, stop.stopId]);

  // Show only the next 4 arrivals
  const sortedData = data
    ? [...data].sort(
        (a, b) =>
          (a.realTime?.minutes ?? a.schedule?.minutes ?? 999) -
          (b.realTime?.minutes ?? b.schedule?.minutes ?? 999)
      )
    : [];
  const limitedEstimates = sortedData.slice(0, 4);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container>
        <Sheet.Header />
        <Sheet.Content drag="y">
          <div className="stop-sheet-content">
            <div className="stop-sheet-header">
              <h2 className="stop-sheet-title">{stop.name}</h2>
              <span className="stop-sheet-id">({stop.stopCode})</span>
            </div>

            <div className={`d-flex flex-wrap flex-row gap-2`}>
              {stop.lines.map((lineObj) => (
                <LineIcon
                  key={lineObj.line}
                  line={lineObj.line}
                  mode="pill"
                  colour={lineObj.colour}
                  textColour={lineObj.textColour}
                />
              ))}
            </div>

            {/* TODO: Enable stop alerts when available */}
            {/*<StopAlert stop={stop} compact />*/}

            {loading ? (
              <StopSummarySheetSkeleton />
            ) : error ? (
              <ErrorDisplay
                error={error}
                onRetry={loadData}
                title={t(
                  "errors.estimates_title",
                  "Error al cargar estimaciones"
                )}
                className="compact"
              />
            ) : data ? (
              <>
                <div className="stop-sheet-estimates">
                  <h3 className="stop-sheet-subtitle">
                    {t("estimates.next_arrivals", "Next arrivals")}
                  </h3>

                  {limitedEstimates.length === 0 ? (
                    <div className="stop-sheet-no-estimates">
                      {t("estimates.none", "No hay estimaciones disponibles")}
                    </div>
                  ) : (
                    <ConsolidatedCirculationList
                      data={data.slice(0, 4)}
                      driver={stop.stopFeed}
                      reduced
                    />
                  )}
                </div>
              </>
            ) : null}
          </div>
        </Sheet.Content>

        <div className="stop-sheet-footer">
          {lastUpdated && (
            <div className="stop-sheet-timestamp">
              {t("estimates.last_updated", "Actualizado a las")}{" "}
              {lastUpdated.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          )}

          <div className="stop-sheet-actions">
            <button
              className="stop-sheet-reload"
              onClick={loadData}
              disabled={loading}
              title={t("estimates.reload", "Recargar estimaciones")}
            >
              <RefreshCw
                className={`reload-icon ${loading ? "spinning" : ""}`}
              />
              {t("estimates.reload", "Recargar")}
            </button>

            <Link
              to={`/stops/${stop.stopId}`}
              className="stop-sheet-view-all"
              onClick={onClose}
            >
              {t("map.view_all_estimates", "Ver todas las estimaciones")}
            </Link>
          </div>
        </div>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
};
