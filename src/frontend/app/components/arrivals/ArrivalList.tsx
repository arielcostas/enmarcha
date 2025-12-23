import React from "react";
import { type Arrival } from "../../api/schema";
import { ArrivalCard } from "./ArrivalCard";
import { ReducedArrivalCard } from "./ReducedArrivalCard";

interface ArrivalListProps {
  arrivals: Arrival[];
  reduced?: boolean;
  onArrivalClick?: (arrival: Arrival) => void;
}

export const ArrivalList: React.FC<ArrivalListProps> = ({
  arrivals,
  reduced,
  onArrivalClick,
}) => {
  const clickable = Boolean(onArrivalClick);

  return (
    <div className="flex flex-col gap-3">
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
          />
        )
      )}
    </div>
  );
};
