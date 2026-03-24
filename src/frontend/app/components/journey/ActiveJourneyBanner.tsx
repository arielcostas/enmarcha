import { Bell, Map, X } from "lucide-react";
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
      className={`relative mx-3 mb-2 rounded-2xl shadow-lg overflow-hidden border transition-colors ${
        isApproaching
          ? "bg-primary-400 border-primary-500"
          : "bg-primary-600 border-primary-700"
      }`}
    >
      {/* Clickable body — navigates to the stop and opens the map for the tracked trip */}
      <Link
        to={`/stops/${activeJourney.stopId}`}
        state={{
          openMap: true,
          selectedTripId: activeJourney.tripId,
        }}
        aria-label={t("journey.view_on_map", "View on map")}
        className="flex items-center gap-3 px-4 py-2.5 pr-14 text-sm text-white w-full"
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
            {activeJourney.stopName}
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
            className="opacity-60 shrink-0"
          >
            <Bell size={16} className="line-through" />
          </span>
        )}

        <Map size={16} className="opacity-60 shrink-0" />
      </Link>

      {/* Cancel button — absolutely positioned so it doesn't nest inside the Link */}
      <button
        type="button"
        onClick={stopJourney}
        aria-label={t("journey.stop_tracking", "Detener seguimiento")}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-white hover:bg-white/20 transition-colors shrink-0"
      >
        <X size={18} />
      </button>
    </div>
  );
}
