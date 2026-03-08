import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BusStopUsagePoint } from "~/api/schema";

interface StopUsageChartProps {
  usage: BusStopUsagePoint[];
}

export const StopUsageChart = ({ usage }: StopUsageChartProps) => {
  const { t } = useTranslation();

  // Get current day of week (1=Monday, 7=Sunday)
  // JS getDay(): 0=Sunday, 1=Monday ... 6=Saturday
  const currentJsDay = new Date().getDay();
  const initialDay = currentJsDay === 0 ? 7 : currentJsDay;

  const currentHour = new Date().getHours();

  const [selectedDay, setSelectedDay] = useState<number>(initialDay);

  const days = [
    { id: 1, label: t("days.monday", "L") },
    { id: 2, label: t("days.tuesday", "M") },
    { id: 3, label: t("days.wednesday", "X") },
    { id: 4, label: t("days.thursday", "J") },
    { id: 5, label: t("days.friday", "V") },
    { id: 6, label: t("days.saturday", "S") },
    { id: 7, label: t("days.sunday", "D") },
  ];

  const filteredData = useMemo(() => {
    const data = usage.filter((u) => u.d === selectedDay);
    // Ensure all 24 hours are represented
    const fullDay = Array.from({ length: 24 }, (_, h) => {
      const match = data.find((u) => u.h === h);
      return { h, t: match?.t ?? 0 };
    });
    return fullDay;
  }, [usage, selectedDay]);

  const maxUsage = useMemo(() => {
    const max = Math.max(...filteredData.map((d) => d.t));
    return max === 0 ? 1 : max;
  }, [filteredData]);

  // Use a linear scale
  const getScaledHeight = (value: number) => {
    if (value <= 0) return 0;
    return (value / maxUsage) * 100;
  };

  if (!usage || usage.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <h2 className="text-xl font-bold">
          {t("stop.usage_title", "Ocupación por horas")}
        </h2>
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-sm backdrop-blur w-fit overflow-x-auto">
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelectedDay(day.id)}
              className={`h-7 min-w-7 px-2 rounded-full flex items-center justify-center transition-colors text-xs font-bold shrink-0 ${
                selectedDay === day.id
                  ? "bg-primary text-white"
                  : "text-muted hover:text-text"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-border/50">
        <div className="h-32 sm:h-48 flex items-end gap-1 sm:gap-1.5 px-0 sm:px-1 relative">
          {/* Horizontal grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 py-1">
            <div className="w-full border-t border-slate-400 border-dashed"></div>
            <div className="w-full border-t border-slate-400 border-dashed"></div>
            <div className="w-full border-t border-slate-400 border-dashed"></div>
          </div>

          {filteredData.map((data) => {
            const height = getScaledHeight(data.t);
            const isServiceHour = data.h >= 7 && data.h < 23;
            const isCurrentHour =
              selectedDay === initialDay && data.h === currentHour;

            let barBg =
              "bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400";
            if (isCurrentHour) {
              barBg =
                "bg-red-500 group-hover:bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
            } else if (isServiceHour) {
              barBg =
                "bg-primary/60 group-hover:bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]";
            }

            return (
              <div
                key={data.h}
                tabIndex={0}
                className="group relative flex-1 flex flex-col items-center h-full justify-end cursor-pointer outline-none"
              >
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ease-out min-h-[2px] ${barBg}`}
                  style={{ height: `${height}%` }}
                >
                  {data.t > 0 && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg border border-white/10 pointer-events-none">
                      {data.t}
                    </div>
                  )}
                </div>
                {data.h % 4 === 0 && (
                  <span
                    className={`text-[10px] font-medium mt-2 absolute -bottom-6 ${isCurrentHour ? "text-red-500 font-bold" : "text-slate-500"}`}
                  >
                    {data.h}h
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-6"></div> {/* Spacer for hour labels */}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic leading-relaxed">
          {t(
            "stop.usage_disclaimer",
            "Datos históricos aproximados de ocupación."
          )}
        </p>
      </div>
    </div>
  );
};
