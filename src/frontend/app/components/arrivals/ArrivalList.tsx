import React from "react";
import { type Arrival } from "../../api/schema";
import { ReducedArrivalCard } from "./ArrivalCard";

interface ArrivalListProps {
  arrivals: Arrival[];
  reduced?: boolean;
}

export const ArrivalList: React.FC<ArrivalListProps> = ({
  arrivals,
  reduced,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {arrivals.map((arrival, index) => (
        <ReducedArrivalCard
          key={`${arrival.route.shortName}-${index}`}
          arrival={arrival}
          reduced={reduced}
        />
      ))}
    </div>
  );
};
