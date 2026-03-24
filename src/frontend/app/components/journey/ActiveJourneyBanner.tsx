import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import RouteIcon from "~/components/RouteIcon";
import { useJourney } from "~/contexts/JourneyContext";
import { useStopArrivals } from "~/hooks/useArrivals";

/**
 * A sticky banner rendered at the bottom of the AppShell (above the nav bar)
 * while a journey is being tracked. Shows live minutes-remaining count and
 * lets the user cancel tracking.
 */
export function ActiveJourneyBanner() {
  const { t } = useTranslation();
  const { activeJourney, stopJourney } = useJourney();

  const { data } = useStopArrivals(
    activeJourney?.stopId ?? "",
    false,
    !!activeJourney
  );

  const [permissionState, setPermissionState] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });

  // Request notification permission the first time a journey starts
  const hasRequestedRef = useRef(false);
  useEffect(() => {
    if (!activeJourney || hasRequestedRef.current) return;
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "default"
    )
      return;

    hasRequestedRef.current = true;
    Notification.requestPermission().then((perm) => {
      setPermissionState(perm);
    });
  }, [activeJourney]);

  if (!activeJourney) return null;

  const liveArrival = data?.arrivals.find(
    (a) => a.tripId === activeJourney.tripId
  );

  const minutes = liveArrival?.estimate.minutes;
  const precision = liveArrival?.estimate.precision;

  const minutesLabel =
    minutes == null
      ? "–"
      : minutes <= 0
        ? t("journey.arriving_now", "¡Llegando!")
        : t("journey.minutes_away", {
            defaultValue: "{{minutes}} min",
            minutes,
          });

  const isApproaching =
    minutes != null &&
    minutes <= activeJourney.notifyAtMinutes &&
    precision !== "past";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-2.5 text-sm border-t transition-colors ${
        isApproaching
          ? "bg-blue-600 text-white border-blue-700"
          : "bg-slate-800 text-white border-slate-700"
      }`}
    >
      <RouteIcon
        line={activeJourney.routeShortName}
        colour={activeJourney.routeColour}
        textColour={activeJourney.routeTextColour}
        mode="pill"
      />

      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight truncate">
          {activeJourney.headsignDestination ??
            t("journey.tracking_bus", "Siguiendo autobús")}
        </p>
        <p className="text-xs opacity-80 truncate">
          <Link
            to={`/stops/${activeJourney.stopId}`}
            className="underline underline-offset-2"
          >
            {activeJourney.stopName}
          </Link>
          {" · "}
          {minutesLabel}
        </p>
      </div>

      {permissionState === "denied" && (
        <span
          title={t(
            "journey.notifications_blocked",
            "Notificaciones bloqueadas"
          )}
          className="opacity-60"
        >
          <Bell size={16} className="line-through" />
        </span>
      )}

      <button
        type="button"
        onClick={stopJourney}
        aria-label={t("journey.stop_tracking", "Detener seguimiento")}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors shrink-0"
      >
        <X size={18} />
      </button>
    </div>
  );
}
