import React from "react";
import { useTranslation } from "react-i18next";
import { type Arrival } from "../../api/schema";
import { ArrivalCard } from "./ArrivalCard";
import { ReducedArrivalCard } from "./ReducedArrivalCard";

interface ArrivalListProps {
  arrivals: Arrival[];
  reduced?: boolean;
  onArrivalClick?: (arrival: Arrival) => void;
  onTrackArrival?: (arrival: Arrival) => void;
  trackedTripId?: string;
}

export const ArrivalList: React.FC<ArrivalListProps> = ({
  arrivals,
  reduced,
  onArrivalClick,
  onTrackArrival,
  trackedTripId,
}) => {
  const { t } = useTranslation();
  const clickable = Boolean(onArrivalClick);

  return (
    <div className="flex flex-col flex-1 gap-3">
      {arrivals.length === 0 && (
        <div className="text-center text-muted mt-16">
          {t("estimates.none", "No hay llegadas próximas disponibles para esta parada.")}
        </div>
      )}
      {arrivals.map((arrival, index) =>
        reduced ? (
          <ReducedArrivalCard
            key={`${arrival.tripId}-${index}`}
            arrival={arrival}
            onClick={clickable ? () => onArrivalClick?.(arrival) : undefined}
          />
        ) : (
          <ArrivalCard
            key={`${arrival.tripId}-${index}`}
            arrival={arrival}
            onClick={clickable ? () => onArrivalClick?.(arrival) : undefined}
            onTrack={onTrackArrival ? () => onTrackArrival(arrival) : undefined}
            isTracked={trackedTripId === arrival.tripId}
          />
        )
      )}
    </div>
  );
};
