import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStopArrivals } from "./useArrivals";
import { useJourney } from "../contexts/JourneyContext";

/**
 * Polls the stop arrivals for the active journey and fires a browser
 * notification when the tracked bus is approaching.
 *
 * Mount this hook once at the app-shell level so it continues tracking
 * even when the user navigates away from the stop page.
 */
export function useJourneyTracker() {
  const { t } = useTranslation();
  const { activeJourney, stopJourney, markNotified } = useJourney();

  const stopId = activeJourney?.stopId ?? "";
  const enabled = !!activeJourney;

  const { data } = useStopArrivals(stopId, false, enabled);

  // Keep a stable ref so the effect below doesn't re-run on every render
  const journeyRef = useRef(activeJourney);
  useEffect(() => {
    journeyRef.current = activeJourney;
  }, [activeJourney]);

  useEffect(() => {
    if (!data || !activeJourney) return;

    const journey = journeyRef.current;
    if (!journey) return;

    const arrival = data.arrivals.find((a) => a.tripId === journey.tripId);

    if (!arrival) {
      // Trip is no longer in the arrivals list — it has passed or expired
      stopJourney();
      return;
    }

    const { minutes, precision } = arrival.estimate;

    // Trip already departed from this stop
    if (precision === "past") {
      stopJourney();
      return;
    }

    // Fire approaching notification if not already sent
    if (!journey.hasNotified && minutes <= journey.notifyAtMinutes) {
      markNotified();

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const title =
          minutes <= 0
            ? t(
                "journey.notification_now_title",
                "¡Tu autobús está llegando!"
              )
            : t("journey.notification_approaching_title", {
                defaultValue: "Tu autobús llega en {{minutes}} min",
                minutes,
              });

        const body = t("journey.notification_body", {
          defaultValue: "Línea {{line}} dirección {{destination}} — {{stop}}",
          line: journey.routeShortName,
          destination: journey.headsignDestination ?? "",
          stop: journey.stopName,
        });

        new Notification(title, {
          body,
          icon: "/icon-512.png",
          tag: `journey-${journey.tripId}`,
        });
      }
    }
  }, [data, activeJourney, markNotified, stopJourney, t]);
}
