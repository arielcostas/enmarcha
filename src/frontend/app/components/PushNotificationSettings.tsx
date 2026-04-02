import { BellOff, BellRing, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { writeFavorites } from "~/utils/idb";

/** Convert a base64url string (as returned by the VAPID endpoint) to a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Sync all three favourites lists from localStorage to IndexedDB. */
async function syncFavouritesToIdb() {
  const keys = [
    "favouriteStops",
    "favouriteRoutes",
    "favouriteAgencies",
  ] as const;
  await Promise.all(
    keys.map((key) => {
      const raw = localStorage.getItem(key);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      return writeFavorites(key, ids);
    })
  );
}

type Status =
  | "loading" // checking current state
  | "unsupported" // browser does not support Push API
  | "denied" // permission was explicitly blocked
  | "subscribed" // user is actively subscribed
  | "unsubscribed"; // user is not subscribed (or permission not yet granted)

export function PushNotificationSettings() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("loading");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    checkStatus().then(setStatus);
  }, []);

  async function checkStatus(): Promise<Status> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return sub ? "subscribed" : "unsubscribed";
    } catch {
      return "unsubscribed";
    }
  }

  async function subscribe() {
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      // Fetch the VAPID public key
      const res = await fetch("/api/push/vapid-public-key");
      if (!res.ok) {
        console.error("Push notifications not configured on this server.");
        return;
      }
      const { publicKey } = await res.json();

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Mirror favourites to IDB before registering so the SW has them from day 1
      await syncFavouritesToIdb();

      const json = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256Dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });

      setStatus("subscribed");
    } finally {
      setWorking(false);
    }
  }

  async function unsubscribe() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus("unsubscribed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-2 text-text">
        {t("settings.push_title", "Notificaciones")}
      </h2>
      <p className="text-sm text-muted mb-4">
        {t(
          "settings.push_description",
          "Recibe notificaciones cuando haya alertas de servicio relevantes para tus paradas, líneas o operadores favoritos."
        )}
      </p>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-muted text-sm">
          <Loader className="w-4 h-4 animate-spin" />
          {t("common.loading", "Cargando...")}
        </div>
      )}

      {status === "unsupported" && (
        <p className="text-sm text-muted p-4 rounded-lg border border-border bg-surface">
          {t(
            "settings.push_unsupported",
            "Tu navegador no soporta notificaciones push. Prueba con Chrome, Edge o Firefox."
          )}
        </p>
      )}

      {status === "denied" && (
        <p className="text-sm text-muted p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700">
          {t(
            "settings.push_permission_denied",
            "Has bloqueado los permisos de notificación en este navegador. Para activarlos, ve a la configuración del sitio y permite las notificaciones."
          )}
        </p>
      )}

      {(status === "subscribed" || status === "unsubscribed") && (
        <label className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface cursor-pointer hover:bg-surface/50 transition-colors">
          <span className="flex items-center gap-2 text-text font-medium">
            {status === "subscribed" ? (
              <BellRing className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-muted" />
            )}
            {status === "subscribed"
              ? t("settings.push_subscribed", "Notificaciones activadas")
              : t(
                  "settings.push_subscribe",
                  "Activar notificaciones de alertas"
                )}
          </span>
          <button
            onClick={status === "subscribed" ? unsubscribe : subscribe}
            disabled={working}
            aria-pressed={status === "subscribed"}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-primary/50
              disabled:opacity-50
              ${status === "subscribed" ? "bg-primary" : "bg-border"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
                ${status === "subscribed" ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
        </label>
      )}
    </section>
  );
}
