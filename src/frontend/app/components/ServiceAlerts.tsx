import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import "./ServiceAlerts.css";

interface ServiceAlert {
  id: string;
  version: number;
  phase: string;
  cause: string;
  effect: string;
  header: Record<string, string>;
  description: Record<string, string>;
  selectors: string[];
  infoUrls: string[];
  eventStartDate: string;
  eventEndDate: string;
}

/** Maps an alert effect to one of the three CSS severity classes. */
function effectToSeverity(effect: string): "info" | "warning" | "error" {
  if (["NoService", "SignificantDelays", "AccessibilityIssue"].includes(effect))
    return "error";
  if (
    ["ReducedService", "Detour", "ModifiedService", "StopMoved"].includes(
      effect
    )
  )
    return "warning";
  return "info";
}

/** Maps an effect to an emoji icon. */
function effectToIcon(effect: string): string {
  const map: Record<string, string> = {
    NoService: "🚫",
    ReducedService: "⚠️",
    SignificantDelays: "🕐",
    Detour: "↩️",
    AdditionalService: "➕",
    ModifiedService: "🔄",
    StopMoved: "📍",
    AccessibilityIssue: "♿",
  };
  return map[effect] ?? "ℹ️";
}

interface ServiceAlertsProps {
  /** If provided, only alerts whose selectors overlap with this list are shown. */
  selectorFilter?: string[];
}

const ServiceAlerts: React.FC<ServiceAlertsProps> = ({ selectorFilter }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.slice(0, 2);

  const { data: alerts, isLoading } = useQuery<ServiceAlert[]>({
    queryKey: ["service-alerts"],
    queryFn: () => fetch("/api/alerts").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading || !alerts) return null;

  const visible = alerts.filter((alert) => {
    if (!selectorFilter || selectorFilter.length === 0) return true;
    return alert.selectors.some((s) => selectorFilter.includes(s));
  });

  if (visible.length === 0) return null;

  return (
    <div className="service-alerts-container stoplist-section">
      <h2 className="page-subtitle">{t("stoplist.service_alerts")}</h2>
      {visible.map((alert) => {
        const severity = effectToSeverity(alert.effect);
        const icon = effectToIcon(alert.effect);
        const title =
          alert.header[lang] ??
          alert.header["es"] ??
          Object.values(alert.header)[0] ??
          "";
        const body =
          alert.description[lang] ??
          alert.description["es"] ??
          Object.values(alert.description)[0] ??
          "";

        return (
          <div key={alert.id} className={`service-alert ${severity}`}>
            <div className="alert-icon">{icon}</div>
            <div className="alert-content">
              <div className="alert-title">{title}</div>
              {body && <div className="alert-message">{body}</div>}
              {alert.infoUrls.length > 0 && (
                <div className="alert-message" style={{ marginTop: "0.25rem" }}>
                  {alert.infoUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "block" }}
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ServiceAlerts;
