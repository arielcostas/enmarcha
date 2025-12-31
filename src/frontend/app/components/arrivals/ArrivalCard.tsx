import { AlertTriangle, BusFront, LocateIcon } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Marquee from "react-fast-marquee";
import { useTranslation } from "react-i18next";
import LineIcon from "~/components/LineIcon";
import { type Arrival } from "../../api/schema";
import "./ArrivalCard.css";

interface ArrivalCardProps {
  arrival: Arrival;
  onClick?: () => void;
}

const AutoMarquee = ({ text }: { text: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkScroll = () => {
      const charWidth = 8;
      const availableWidth = el.offsetWidth;
      const textWidth = text.length * charWidth;
      setShouldScroll(textWidth > availableWidth);
    };

    checkScroll();
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  if (shouldScroll) {
    return (
      <div ref={containerRef} className="w-full overflow-hidden">
        <Marquee speed={40} gradient={false}>
          <div className="mr-32 text-xs font-mono text-slate-500 dark:text-slate-400">
            {text}
          </div>
        </Marquee>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden text-xs font-mono text-slate-500 dark:text-slate-400 truncate"
    >
      {text}
    </div>
  );
};

export const ArrivalCard: React.FC<ArrivalCardProps> = ({
  arrival,
  onClick,
}) => {
  const { t } = useTranslation();
  const { route, headsign, estimate, delay, shift, vehicleInformation } =
    arrival;

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
      kind?: "regular" | "gps" | "delay" | "warning" | "vehicle";
    }> = [];

    // Badge/Shift info as a chip
    if (headsign.badge) {
      chips.push({
        label: headsign.badge,
        kind: "regular",
      });
    }

    // Delay chip
    if (delay) {
      const delta = Math.round(delay.minutes);
      const absDelta = Math.abs(delta);

      if (delta === 0) {
        chips.push({
          label: t("estimates.delay_on_time"),
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
          label: t("estimates.delay_positive", { minutes: delta }),
          tone,
          kind: "delay",
        });
      } else {
        const tone = absDelta <= 2 ? "delay-ok" : "delay-early";
        chips.push({
          label: t("estimates.delay_negative", { minutes: absDelta }),
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
        label: t("estimates.low_accuracy"),
        tone: "warning",
        kind: "warning",
      });
    } else if (
      estimate.precision === "confident" &&
      arrival.currentPosition !== null
    ) {
      chips.push({
        label: t("estimates.bus_gps_position"),
        kind: "gps",
      });
    }

    if (estimate.precision === "scheduled") {
      chips.push({
        label: t("estimates.no_realtime"),
        tone: "warning",
        kind: "warning",
      });
    }

    // Vehicle information if available
    if (vehicleInformation) {
      let label = vehicleInformation.identifier;
      if (vehicleInformation.make) {
        label += ` (${vehicleInformation.make}`;
        if (vehicleInformation.model) {
          label += ` ${vehicleInformation.model}`;
        }
        if (vehicleInformation.year) {
          label += ` - ${vehicleInformation.year}`;
        }
        label += `)`;
      }
      chips.push({
        label,
        kind: "vehicle",
      });
    }

    return chips;
  }, [delay, shift, estimate.precision, t, headsign.badge, vehicleInformation]);

  const isClickable = !!onClick && estimate.precision !== "past";
  const Tag = isClickable ? "button" : "div";

  return (
    <Tag
      type={isClickable ? "button" : undefined}
      onClick={isClickable ? onClick : undefined}
      className={`w-full text-left flex items-start gap-3 rounded-xl px-3 py-3 transition-all bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-sm ${
        isClickable
          ? "hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.98] cursor-pointer"
          : ""
      }`}
    >
      <div className="shrink-0 min-w-[7ch] mt-0.5">
        <LineIcon
          line={route.shortName}
          colour={route.colour}
          textColour={route.textColour}
          mode="pill"
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <span
              className={`text-base font-bold overflow-hidden text-ellipsis line-clamp-2 leading-tight text-slate-900 dark:text-slate-100 ${estimate.precision == "past" ? "line-through opacity-60" : ""}`}
            >
              {headsign.destination}
            </span>
            {headsign.marquee && (
              <div className="mt-0.5">
                <AutoMarquee text={headsign.marquee} />
              </div>
            )}
          </div>
          <div
            className={`
              inline-flex items-center justify-center px-2 py-1 rounded-lg shrink-0 min-w-12
              ${timeClass}
            `.trim()}
          >
            <div className="flex flex-col items-center leading-none">
              <span className="text-lg font-bold">{etaValue}</span>
              <span className="text-[0.55rem] font-bold uppercase tracking-tighter opacity-80">
                {etaUnit}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {metaChips.map((chip, idx) => {
            let chipColourClasses = "";
            switch (chip.tone) {
              case "delay-ok":
                chipColourClasses =
                  "bg-green-600/10 dark:bg-green-600/20 text-green-700 dark:text-green-300";
                break;
              case "delay-warn":
                chipColourClasses =
                  "bg-amber-600/10 dark:bg-yellow-600/20 text-amber-700 dark:text-yellow-300";
                break;
              case "delay-critical":
                chipColourClasses =
                  "bg-red-400/10 dark:bg-red-600/20 text-red-600 dark:text-red-300";
                break;
              case "delay-early":
                chipColourClasses =
                  "bg-blue-400/10 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300";
                break;
              case "warning":
                chipColourClasses =
                  "bg-orange-400/10 dark:bg-orange-600/20 text-orange-700 dark:text-orange-300";
                break;
              default:
                chipColourClasses =
                  "bg-black/[0.04] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400";
            }

            return (
              <span
                key={`${chip.label}-${idx}`}
                className={`text-xs px-2.5 py-0.5 rounded-full flex items-center justify-center gap-1 shrink-0 font-medium tracking-wide ${chipColourClasses}`}
              >
                {chip.kind === "gps" && (
                  <LocateIcon className="w-3 h-3 inline-block" />
                )}
                {chip.kind === "warning" && (
                  <AlertTriangle className="w-3 h-3 inline-block" />
                )}
                {chip.kind === "vehicle" && (
                  <BusFront className="w-3 h-3 inline-block" />
                )}
                {chip.label}
              </span>
            );
          })}
        </div>
      </div>
    </Tag>
  );
};
