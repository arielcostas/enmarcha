import { useQuery } from "@tanstack/react-query";
import { ArrowUpToLine, CalendarDays, Clock, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { ScheduledTrip } from "~/api/schema";
import { fetchStopSchedule } from "~/api/transit";
import RouteIcon from "~/components/RouteIcon";
import { useBackButton, usePageTitle } from "~/contexts/PageTitleContext";
import "../tailwind-full.css";

const formatDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function TripRow({
  trip,
  isPast,
  backTo,
}: {
  trip: ScheduledTrip;
  isPast: boolean;
  backTo: string;
}) {
  const { t } = useTranslation();
  const isDropOffOnly = trip.pickupType === "NONE";
  const isPickUpOnly = trip.dropOffType === "NONE";

  const badges: React.ReactNode[] = [];
  if (trip.isFirstStop) {
    badges.push(
      <span
        key="first"
        className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      >
        {t("schedule.trip_start", "Inicio")}
      </span>
    );
  }
  if (trip.isLastStop) {
    badges.push(
      <span
        key="last"
        className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      >
        {t("schedule.trip_end", "Final")}
      </span>
    );
  }
  if (isDropOffOnly) {
    badges.push(
      <span
        key="dropoff"
        className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      >
        {t("routes.drop_off_only", "Bajada")}
      </span>
    );
  }
  if (isPickUpOnly) {
    badges.push(
      <span
        key="pickup"
        className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
      >
        {t("routes.pickup_only", "Subida")}
      </span>
    );
  }

  return (
    <Link
      to={`/routes/${encodeURIComponent(trip.routeId)}`}
      state={{ backTo: backTo }}
      className={`flex items-center gap-2.5 px-3 py-3 border-b border-border last:border-b-0 hover:bg-surface/60 active:bg-surface transition-colors ${isPast ? "opacity-40" : ""}`}
    >
      {/* Time */}
      <span
        className={`w-11 shrink-0 text-sm font-mono font-semibold tabular-nums ${isPast ? "line-through text-muted" : "text-text"}`}
      >
        {formatTime(trip.scheduledDeparture)}
      </span>

      {/* Route icon */}
      <div className="shrink-0">
        <RouteIcon
          line={trip.routeShortName ?? "?"}
          colour={trip.routeColor}
          textColour={trip.routeTextColor}
          mode="pill"
        />
      </div>

      {/* Destination + origin → dest + operator */}
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-text truncate">
          {trip.headsign ?? trip.routeShortName}
        </span>
        {(trip.originStop || trip.destinationStop) && (
          <p className="text-[11px] text-muted truncate leading-tight">
            {trip.originStop}
            {trip.originStop && trip.destinationStop ? " → " : ""}
            {trip.destinationStop}
          </p>
        )}
        {trip.operator && (
          <p className="text-[10px] text-muted/70 truncate leading-tight">
            {trip.operator}
          </p>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="shrink-0 flex flex-col gap-1 items-end">{badges}</div>
      )}
    </Link>
  );
}

export default function StopSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();

  const weekDays = useMemo(() => {
    const base = new Date();
    return [-1, 0, 1, 2, 3, 4, 5].map((offset) => {
      const date = new Date(base);
      date.setDate(base.getDate() + offset);

      let label: string;
      if (offset === -1) {
        label = t("routes.day_yesterday", "Ayer");
      } else if (offset === 0) {
        label = t("routes.day_today", "Hoy");
      } else if (offset === 1) {
        label = t("routes.day_tomorrow", "Mañana");
      } else {
        label = date.toLocaleDateString(i18n.language || "es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      }

      return { key: formatDateKey(date), date, label };
    });
  }, [i18n.language, t]);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    formatDateKey(new Date())
  );

  const isToday = selectedDateKey === formatDateKey(new Date());

  const now = new Date();
  const nowSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const scrollRef = useRef<HTMLDivElement>(null);
  const nowMarkerRef = useRef<HTMLDivElement>(null);
  const scrollKey = `stop-schedule-scroll-${id}-${selectedDateKey}`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["stop-schedule", id, selectedDateKey],
    queryFn: () => fetchStopSchedule(id!, selectedDateKey),
    enabled: !!id,
  });

  // Restore scroll position after data loads
  useEffect(() => {
    if (!data || !scrollRef.current) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      scrollRef.current.scrollTop = parseInt(saved, 10);
    }
  }, [data, scrollKey]);

  const handleScroll = () => {
    if (scrollRef.current) {
      sessionStorage.setItem(scrollKey, String(scrollRef.current.scrollTop));
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToNow = () => {
    nowMarkerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const nowIndex = useMemo(() => {
    if (!data || !isToday) return -1;
    return data.trips.findIndex(
      (trip) => trip.scheduledDeparture >= nowSeconds
    );
  }, [data, isToday, nowSeconds]);

  usePageTitle(
    data?.stopName
      ? `${t("schedule.title_prefix", "Horarios")} · ${data.stopName}`
      : t("schedule.title", "Horarios de parada")
  );

  useBackButton({ to: `/stops/${id}` });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-surface border-b border-border shrink-0 flex items-center gap-2">
        <CalendarDays size={15} className="text-muted shrink-0" />
        <select
          className="flex-1 px-2 py-1.5 bg-surface text-text text-sm rounded-md border border-border focus:ring-2 focus:ring-primary outline-none"
          value={selectedDateKey}
          onChange={(e) => setSelectedDateKey(e.target.value)}
          aria-label={t("routes.week_date", "Fecha")}
        >
          {weekDays.map((day) => (
            <option key={day.key} value={day.key}>
              {day.label}
            </option>
          ))}
        </select>
        <button
          className="shrink-0 p-1.5 rounded-md border border-border text-muted hover:text-text hover:bg-background active:scale-95 transition-all"
          onClick={scrollToTop}
          aria-label={t("schedule.scroll_to_top", "Ir al inicio")}
          title={t("schedule.scroll_to_top", "Ir al inicio")}
        >
          <ArrowUpToLine size={15} />
        </button>
        {isToday && (
          <button
            className={`shrink-0 p-1.5 rounded-md border transition-all active:scale-95 ${nowIndex === -1 ? "text-muted/40 border-border/40 cursor-default" : "border-border text-muted hover:text-text hover:bg-background"}`}
            onClick={nowIndex !== -1 ? scrollToNow : undefined}
            aria-label={t("schedule.scroll_to_now", "Ir a ahora")}
            title={t("schedule.scroll_to_now", "Ahora")}
            disabled={nowIndex === -1}
          >
            <Timer size={15} />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-background"
      >
        {isLoading ? (
          <div className="flex flex-col">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-3 border-b border-border animate-pulse"
              >
                <div className="w-11 h-4 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="w-10 h-5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-4 rounded bg-slate-200 dark:bg-slate-700 max-w-30" />
                  <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 max-w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm text-muted">
              {t("schedule.error", "No se pudo cargar el horario.")}
            </p>
          </div>
        ) : !data || data.trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="bg-surface p-4 rounded-full mb-4 border border-border">
              <Clock size={28} className="text-muted" />
            </div>
            <h4 className="text-base font-bold text-text mb-1">
              {t("schedule.no_service", "Sin servicio")}
            </h4>
            <p className="text-sm text-muted max-w-xs">
              {t(
                "schedule.no_service_desc",
                "No hay viajes programados en esta parada para la fecha seleccionada."
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="px-3 py-1.5 bg-surface border-b border-border">
              <p className="text-[11px] text-muted uppercase tracking-wide font-semibold">
                {t("schedule.summary", {
                  count: data.trips.length,
                  defaultValue: "{{count}} salidas",
                })}
              </p>
            </div>
            <div>
              {data.trips.map((trip, i) => (
                <div key={`${trip.scheduledDeparture}-${trip.routeId}-${i}`}>
                  {i === nowIndex && (
                    <div
                      ref={nowMarkerRef}
                      className="flex items-center gap-2 px-3 py-1 bg-primary/10 border-b border-primary/20"
                    >
                      <Timer size={11} className="text-primary" />
                      <span className="text-[10px] text-primary font-semibold uppercase tracking-wide">
                        {t("schedule.now", "Ahora")}
                      </span>
                    </div>
                  )}
                  <TripRow
                    trip={trip}
                    isPast={isToday && trip.scheduledDeparture < nowSeconds}
                    backTo={`/stops/${id}/schedule`}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
