import { AlertTriangle, LocateIcon } from "lucide-react";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import LineIcon from "~/components/LineIcon";
import { type Arrival } from "../../api/schema";
import "./ArrivalCard.css";

interface ArrivalCardProps {
  arrival: Arrival;
}

export const ReducedArrivalCard: React.FC<ArrivalCardProps> = ({ arrival }) => {
  const { t } = useTranslation();
  const { route, headsign, estimate, delay, shift } = arrival;

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

  const metaChips = useMemo(() => {
    const chips: Array<{
      label: string;
      tone?: string;
      kind?: "regular" | "gps" | "delay" | "warning";
    }> = [];

    // Delay chip
    if (delay) {
      const delta = Math.round(delay.minutes);
      const absDelta = Math.abs(delta);

      if (delta === 0) {
        chips.push({
          label: "OK",
          tone: "delay-ok",
          kind: "delay",
        });
      } else if (delta > 0) {
        const tone =
          delta <= 2
            ? "delay-ok"
            : delta <= 10
              ? "delay-warn"
              : "delay-critical";
        chips.push({
          label: `R${delta}`,
          tone,
          kind: "delay",
        });
      } else {
        const tone = absDelta <= 2 ? "delay-ok" : "delay-early";
        chips.push({
          label: `A${absDelta}`,
          tone,
          kind: "delay",
        });
      }
    }

    // Shift chip
    if (shift) {
      chips.push({
        label: `${shift.shiftName} · ${shift.shiftTrip}`,
        kind: "regular",
      });
    }

    // Precision chips
    if (estimate.precision === "unsure") {
      chips.push({
        label: "!",
        tone: "warning",
        kind: "warning",
      });
    } else if (estimate.precision === "confident") {
      chips.push({
        label: "", // Just the icon for reduced
        kind: "gps",
      });
    }

    return chips;
  }, [delay, shift, estimate.precision]);

  return (
    <div className="flex-none flex items-center gap-2.5 min-h-12 rounded px-3 py-2.5 transition-all bg-slate-50 dark:bg-slate-800 shadow-sm">
      <div className="shrink-0 min-w-[7ch]">
        <LineIcon
          line={route.shortName}
          colour={route.colour}
          textColour={route.textColour}
          mode="pill"
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span
          className={`text-base font-medium overflow-hidden text-ellipsis line-clamp-2 leading-tight ${estimate.precision == "past" ? "line-through" : ""}`}
        >
          {headsign.destination}
        </span>
        {metaChips.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {metaChips.map((chip, idx) => {
              let chipColourClasses = "";
              switch (chip.tone) {
                case "delay-ok":
                  chipColourClasses =
                    "bg-green-600/20 dark:bg-green-600/30 text-green-700 dark:text-green-300";
                  break;
                case "delay-warn":
                  chipColourClasses =
                    "bg-amber-600/20 dark:bg-yellow-600/30 text-amber-700 dark:text-yellow-300";
                  break;
                case "delay-critical":
                  chipColourClasses =
                    "bg-red-400/20 dark:bg-red-600/30 text-red-600 dark:text-red-300";
                  break;
                case "delay-early":
                  chipColourClasses =
                    "bg-blue-400/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-300";
                  break;
                case "warning":
                  chipColourClasses =
                    "bg-orange-400/20 dark:bg-orange-600/30 text-orange-700 dark:text-orange-300";
                  break;
                default:
                  chipColourClasses =
                    "bg-black/[0.06] dark:bg-white/[0.12] text-slate-600 dark:text-slate-400";
              }

              return (
                <span
                  key={`${chip.label}-${idx}`}
                  className={`text-xs px-2.5 py-0.5 rounded-full flex items-center justify-center gap-1 shrink-0 font-medium tracking-wide ${chipColourClasses}`}
                >
                  {chip.kind === "gps" && (
                    <LocateIcon className="w-3 h-3 my-0.5 inline-block" />
                  )}
                  {chip.kind === "warning" && (
                    <AlertTriangle className="w-3 h-3 my-0.5 inline-block" />
                  )}
                  {chip.label}
                </span>
              );
            })}
          </div>
        )}
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
