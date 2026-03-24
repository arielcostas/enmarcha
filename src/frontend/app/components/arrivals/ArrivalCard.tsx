import { AlertTriangle, BusFront, LocateIcon, Navigation } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Marquee from "react-fast-marquee";
import { useTranslation } from "react-i18next";
import RouteIcon from "~/components/RouteIcon";
import { type Arrival } from "../../api/schema";
import "./ArrivalCard.css";

interface ArrivalCardProps {
  arrival: Arrival;
  onClick?: () => void;
  onTrack?: () => void;
  isTracked?: boolean;
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
  onTrack,
  isTracked = false,
}) => {
  const { t } = useTranslation();
  const {
    route,
    headsign,
    estimate,
    delay,
    shift,
    vehicleInformation,
    operator,
  } = arrival;

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
      className={`arrival-card w-full text-left gap-x-4 gap-y-3 rounded-xl p-2 transition-all bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-sm ${
        isClickable
          ? "hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.98] cursor-pointer"
          : ""
      }`}
    >
      <div className="arrival-card--icon shrink-0 min-w-[3ch] mt-0.5">
        <RouteIcon
          line={route.shortName}
          colour={route.colour}
          textColour={route.textColour}
          mode="pill"
        />
      </div>

      <div className="arrival-card--route shrink-0 flex flex-col gap-1">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <span
              className={`text-base font-bold overflow-hidden text-ellipsis line-clamp-2 leading-tight text-slate-900 dark:text-slate-100 ${estimate.precision == "past" ? "line-through opacity-60" : ""}`}
            >
              {headsign.destination}
            </span>
            <div className="mt-0.5 w-auto flex">
              {operator && (
                <span className="text-xs font-mono text-slate-700 dark:text-slate-200 font-medium shrink-0">
                  {operator}
                  {headsign.marquee && <>&nbsp;·&nbsp;</>}
                </span>
              )}
              {headsign.marquee && <AutoMarquee text={headsign.marquee} />}
            </div>
          </div>
        </div>
      </div>
      <div
        className={`
          arrival-card--minutes inline-flex items-center justify-center px-2 py-1 rounded-lg min-w-11 text-center ${timeClass}
        `.trim()}
      >
        <span className="text-lg font-bold leading-tight">
          {etaValue}&apos;
        </span>
      </div>

      <div className="arrival-card--meta flex w-auto items-center gap-2 flex-wrap">
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

        {onTrack && estimate.precision !== "past" && (
          // Use a <span> instead of a <button> here because this element can
          // be rendered inside a <button> (when isClickable=true), and nested
          // <button> elements are invalid HTML.
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onTrack();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onTrack();
              }
            }}
            aria-label={
              isTracked
                ? t("journey.stop_tracking", "Detener seguimiento")
                : t("journey.track_bus", "Seguir este autobús")
            }
            aria-pressed={isTracked}
            className={`ml-auto text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 font-medium tracking-wide transition-colors cursor-pointer select-none ${
              isTracked
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-black/[0.04] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400"
            }`}
          >
            <Navigation className="w-3 h-3" />
            {isTracked
              ? t("journey.tracking", "Siguiendo")
              : t("journey.track", "Seguir")}
          </span>
        )}
      </div>
    </Tag>
  );
};
