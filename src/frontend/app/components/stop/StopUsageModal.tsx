import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "react-modal-sheet";
import type { BusStopUsagePoint } from "~/api/schema";

interface StopUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  usage: BusStopUsagePoint[];
}

export const StopUsageModal = ({
  isOpen,
  onClose,
  usage,
}: StopUsageModalProps) => {
  const { t } = useTranslation();

  // Get current day of week (1=Monday, 7=Sunday)
  // JS getDay(): 0=Sunday, 1=Monday ... 6=Saturday
  const currentJsDay = new Date().getDay();
  const initialDay = currentJsDay === 0 ? 7 : currentJsDay;

  const [selectedDay, setSelectedDay] = useState<number>(initialDay);

  const days = [
    { id: 1, label: t("days.monday") },
    { id: 2, label: t("days.tuesday") },
    { id: 3, label: t("days.wednesday") },
    { id: 4, label: t("days.thursday") },
    { id: 5, label: t("days.friday") },
    { id: 6, label: t("days.saturday") },
    { id: 7, label: t("days.sunday") },
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

  // Use a square root scale to make smaller values more visible
  const getScaledHeight = (value: number) => {
    if (value <= 0) return 0;
    const scaledValue = Math.sqrt(value);
    const scaledMax = Math.sqrt(maxUsage);
    return (scaledValue / scaledMax) * 100;
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container className="bg-white! dark:bg-black! !rounded-t-[20px]">
        <Sheet.Header className="bg-white! dark:bg-black! !rounded-t-[20px]" />
        <Sheet.Content className="p-6 pb-12 text-slate-900 dark:text-slate-100">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold">
                {t("stop.usage_title", "Ocupación por horas")}
              </h2>
              <div className="flex items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-sm backdrop-blur w-fit">
                {days.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDay(day.id)}
                    className={`h-8 min-w-8 px-2 rounded-full flex items-center justify-center transition-colors text-xs font-bold ${
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

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-border/50">
              <div className="h-64 flex items-end gap-1.5 px-1 relative">
                {/* Horizontal grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 py-1">
                  <div className="w-full border-t border-slate-400 border-dashed"></div>
                  <div className="w-full border-t border-slate-400 border-dashed"></div>
                  <div className="w-full border-t border-slate-400 border-dashed"></div>
                </div>

                {filteredData.map((data) => {
                  const height = getScaledHeight(data.t);
                  const isServiceHour = data.h >= 7 && data.h < 23;

                  return (
                    <div
                      key={data.h}
                      className="group relative flex-1 flex flex-col items-center h-full justify-end"
                    >
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ease-out min-h-[2px] ${
                          isServiceHour
                            ? "bg-primary/60 group-hover:bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]"
                            : "bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400"
                        }`}
                        style={{ height: `${height}%` }}
                      >
                        {data.t > 0 && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg border border-white/10">
                            {data.t} {t("stop.usage_passengers", "pas.")}
                          </div>
                        )}
                      </div>
                      {data.h % 4 === 0 && (
                        <span className="text-[10px] font-medium text-slate-500 mt-2 absolute -bottom-6">
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
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center uppercase tracking-wider font-semibold">
                {t(
                  "stop.usage_scale_info",
                  "Escala no lineal para resaltar valores bajos"
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic leading-relaxed">
                {t(
                  "stop.usage_disclaimer",
                  "Datos históricos aproximados de ocupación."
                )}
              </p>
            </div>
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
};
