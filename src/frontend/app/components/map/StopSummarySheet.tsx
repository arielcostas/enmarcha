import { RefreshCw } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "react-modal-sheet";
import { Link } from "react-router";
import { ArrivalList } from "~/components/arrivals/ArrivalList";
import { useStopArrivals } from "../../hooks/useArrivals";
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

export const StopSummarySheet: React.FC<StopSheetProps> = ({
  isOpen,
  onClose,
  stop,
}) => {
  const { t } = useTranslation();
  const {
    data,
    isLoading: loading,
    error,
    refetch: loadData,
    dataUpdatedAt,
  } = useStopArrivals(stop.stopId, true, isOpen);

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  // Show only the next 4 arrivals
  const limitedEstimates = data?.arrivals.slice(0, 4) ?? [];

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

            <div className={`flex flex-wrap flex-row gap-2`}>
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
                error={{
                  type: error.message.includes("HTTP") ? "server" : "network",
                  message: error.message,
                }}
                onRetry={() => loadData()}
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
                    <ArrivalList arrivals={limitedEstimates} reduced />
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
