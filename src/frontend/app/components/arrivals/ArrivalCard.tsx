import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import LineIcon from "~/components/LineIcon";
import { type Arrival } from "../../api/schema";
import "./ArrivalCard.css";

interface ArrivalCardProps {
  arrival: Arrival;
  reduced?: boolean;
}

export const ArrivalCard: React.FC<ArrivalCardProps> = ({
  arrival,
  reduced,
}) => {
  const { t } = useTranslation();
  const { route, headsign, estimate } = arrival;

  const etaValue = estimate.minutes.toString();
  const etaUnit = t("estimates.minutes", "min");

  const timeClass = useMemo(() => {
    switch (estimate.precision) {
      case "confident":
        return "time-running";
      case "unsure":
        return "time-delayed";
      case "past":
        return "time-past";
      default:
        return "time-scheduled";
    }
  }, [estimate.precision]);

  return (
    <div
      className={`
        flex-none flex items-center gap-2.5 min-h-12
        bg-(--message-background-color) border border-(--border-color)
        rounded-xl px-3 py-2.5 transition-all
        ${reduced ? "reduced" : ""}
      `.trim()}
    >
      <div className="shrink-0 min-w-[7ch]">
        <LineIcon
          line={route.shortName}
          colour={route.colour}
          textColour={route.textColour}
          mode="pill"
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <strong
          className={`text-base overflow-hidden text-ellipsis line-clamp-2 leading-tight ${estimate.precision == "past" ? "line-through" : ""}`}
        >
          {headsign.destination}
        </strong>
      </div>
      <div
        className={`
          inline-flex items-center justify-center px-2 py-1.5 rounded-xl shrink-0
          ${timeClass}
        `.trim()}
      >
        <div className="flex flex-col items-center leading-none">
          <span className="text-lg font-bold leading-none">{etaValue}</span>
          <span className="text-[0.65rem] uppercase tracking-wider mt-0.5 opacity-90">
            {etaUnit}
          </span>
        </div>
      </div>
    </div>
  );
};
