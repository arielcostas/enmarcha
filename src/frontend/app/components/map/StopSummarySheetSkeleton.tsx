import React from "react";
import { useTranslation } from "react-i18next";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

interface StopSheetSkeletonProps {
  rows?: number;
}

export const StopSummarySheetSkeleton: React.FC<StopSheetSkeletonProps> = ({
  rows = 4,
}) => {
  const { t } = useTranslation();

  return (
    <SkeletonTheme
      baseColor="var(--skeleton-base)"
      highlightColor="var(--skeleton-highlight)"
    >
      <div className="stop-sheet-estimates">
        <h3 className="stop-sheet-subtitle">
          {t("estimates.next_arrivals", "Next arrivals")}
        </h3>

        <div className="stop-sheet-estimates-list">
          {Array.from({ length: rows }, (_, index) => (
            <div key={`skeleton-${index}`} className="stop-sheet-estimate-item">
              <div className="stop-sheet-estimate-line">
                <Skeleton
                  width="40px"
                  height="24px"
                  style={{ borderRadius: "4px" }}
                />
              </div>

              <div className="stop-sheet-estimate-details">
                <div className="stop-sheet-estimate-route">
                  <Skeleton width="120px" height="0.95rem" />
                </div>
                <div className="stop-sheet-estimate-time">
                  <Skeleton width="80px" height="0.85rem" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stop-sheet-footer">
        <div className="stop-sheet-timestamp">
          <Skeleton width="140px" height="0.8rem" />
        </div>

        <div className="stop-sheet-actions">
          <div
            className="stop-sheet-reload"
            style={{
              opacity: 0.6,
              pointerEvents: "none",
            }}
          >
            <Skeleton width="70px" height="0.85rem" />
          </div>

          <div
            className="stop-sheet-view-all"
            style={{
              background: "var(--service-background)",
              cursor: "not-allowed",
              pointerEvents: "none",
            }}
          >
            <Skeleton width="180px" height="0.85rem" />
          </div>
        </div>
      </div>
    </SkeletonTheme>
  );
};
