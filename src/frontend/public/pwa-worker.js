const CACHE_VERSION = "20260211a";
const STATIC_CACHE_NAME = `static-cache-${CACHE_VERSION}`;
const STATIC_CACHE_ASSETS = [
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/icon-monochrome-256.png",
  "/icon.svg",
];

const EXPR_CACHE_AFTER_FIRST_VIEW = /(\/assets\/.*)/;

const ESTIMATES_MIN_AGE = 15 * 1000;
const ESTIMATES_MAX_AGE = 30 * 1000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const doCleanup = async () => {
    // Cleans the old caches
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((name) => {
        if (name !== STATIC_CACHE_NAME) {
          return caches.delete(name);
        }
      })
    );

    await self.clients.claim();
  };

  event.waitUntil(doCleanup());
});

self.addEventListener("fetch", async (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore requests with unsupported schemes
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Navigating => we don't intercept anything, if it fails, good luck
  if (request.mode === "navigate") {
    return;
  }

  // Static => cache first, if not, network; if not, fallback
  const isAssetCacheable =
    STATIC_CACHE_ASSETS.includes(url.pathname) ||
    EXPR_CACHE_AFTER_FIRST_VIEW.test(url.pathname);
  if (request.method === "GET" && isAssetCacheable) {
    const response = handleStaticRequest(request);
    if (response !== null) {
      event.respondWith(response);
    }
    return;
  }
});

async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const netResponse = await fetch(request);
    if (netResponse.ok) cache.put(request, netResponse.clone());
    return netResponse;
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB helpers (inline — classic SW scripts cannot use ES module imports)
// Schema must match app/utils/idb.ts
// ---------------------------------------------------------------------------

const IDB_NAME = "enmarcha-sw";
const IDB_VERSION = 1;

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("favorites")) {
        db.createObjectStore("favorites", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("alertState")) {
        db.createObjectStore("alertState", { keyPath: "alertId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Push notification handler
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const {
    alertId,
    version,
    header,
    description,
    selectors = [],
    effect,
  } = payload;

  const db = await idbOpen();

  // Check per-alert state — skip if already shown at this version or silenced
  const alertState = await idbGet(db, "alertState", alertId);
  if (alertState) {
    if (alertState.silenced) {
      db.close();
      return;
    }
    if (alertState.lastVersion >= version) {
      db.close();
      return;
    }
  }

  // Read favourites from IDB
  const stopRec = await idbGet(db, "favorites", "favouriteStops");
  const routeRec = await idbGet(db, "favorites", "favouriteRoutes");
  const agencyRec = await idbGet(db, "favorites", "favouriteAgencies");
  db.close();

  const favStops = stopRec?.ids ?? [];
  const favRoutes = routeRec?.ids ?? [];
  const favAgencies = agencyRec?.ids ?? [];

  const hasAnyFavourites =
    favStops.length > 0 || favRoutes.length > 0 || favAgencies.length > 0;

  // If user has favourites, only show if a selector matches; otherwise show all (fail-open)
  if (hasAnyFavourites) {
    const matches = selectors.some((raw) => {
      const hashIdx = raw.indexOf("#");
      if (hashIdx === -1) return false;
      const type = raw.slice(0, hashIdx);
      const id = raw.slice(hashIdx + 1);
      if (type === "stop") return favStops.includes(id);
      if (type === "route") return favRoutes.includes(id);
      if (type === "agency") return favAgencies.includes(id);
      return false;
    });
    if (!matches) return;
  }

  // Determine notification title and body (prefer user's browser language, fallback to "es")
  const lang = (self.navigator?.language ?? "es").slice(0, 2);
  const title =
    header[lang] ??
    header["es"] ??
    Object.values(header)[0] ??
    "Alerta de servicio";
  const body =
    description[lang] ??
    description["es"] ??
    Object.values(description)[0] ??
    "";

  // Map effect to an emoji hint for better at-a-glance reading
  const iconHint =
    {
      NoService: "🚫",
      ReducedService: "⚠️",
      SignificantDelays: "🕐",
      Detour: "↩️",
      AdditionalService: "➕",
      StopMoved: "📍",
    }[effect] ?? "ℹ️";

  // Save the new version so we don't re-show the same notification
  const db2 = await idbOpen();
  await idbPut(db2, "alertState", {
    alertId,
    silenced: false,
    lastVersion: version,
  });
  db2.close();

  // Build a deep-link from the first selector
  let firstLink = "/";
  if (selectors.length > 0) {
    const first = selectors[0];
    const hashIdx = first.indexOf("#");
    if (hashIdx !== -1) {
      const type = first.slice(0, hashIdx);
      const id = first.slice(hashIdx + 1);
      if (type === "stop") firstLink = `/stops/${encodeURIComponent(id)}`;
      else if (type === "route")
        firstLink = `/routes/${encodeURIComponent(id)}`;
    }
  }

  await self.registration.showNotification(`${iconHint} ${title}`, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-monochrome-256.png",
    tag: alertId,
    data: { alertId, version, link: firstLink },
    actions: [
      { action: "open", title: "Ver detalles" },
      { action: "silence", title: "No mostrar más" },
    ],
  });
}

// ---------------------------------------------------------------------------
// Notification click handler
// ---------------------------------------------------------------------------

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "silence") {
    event.waitUntil(
      (async () => {
        const { alertId, version } = event.notification.data ?? {};
        if (!alertId) return;
        const db = await idbOpen();
        await idbPut(db, "alertState", {
          alertId,
          silenced: true,
          lastVersion: version ?? 0,
        });
        db.close();
      })()
    );
    return;
  }

  // Default / "open" action — focus or open the app at the alert's deep link
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(link);
            return client.focus();
          }
        }
        return self.clients.openWindow(link);
      })
  );
});

// ---------------------------------------------------------------------------
// Re-subscribe handler (fires when the push subscription is invalidated)
// ---------------------------------------------------------------------------

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const newSubscription =
        event.newSubscription ??
        (await self.registration.pushManager.subscribe(
          event.oldSubscription
            ? {
                userVisibleOnly: true,
                applicationServerKey:
                  event.oldSubscription.options.applicationServerKey,
              }
            : { userVisibleOnly: true }
        ));

      if (!newSubscription) return;

      const { endpoint, keys } = newSubscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          p256Dh: keys?.p256dh,
          auth: keys?.auth,
        }),
      });
    })()
  );
});
