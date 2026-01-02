const CACHE_VERSION = "20260101a";
const STATIC_CACHE_NAME = `static-cache-${CACHE_VERSION}`;
const STATIC_CACHE_ASSETS = ["/favicon.ico", "/icon-square.png", "/icon-round.jpg", "/icon-inverse.png"];

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
