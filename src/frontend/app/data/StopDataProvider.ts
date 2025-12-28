import { APP_CONSTANTS } from "~/config/constants";

export interface Stop {
  stopId: string;
  stopCode?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  lines: {
    line: string;
    colour: string;
    textColour: string;
  }[];
  favourite?: boolean;
  type?: "bus" | "coach" | "train" | "unknown";
}

interface CacheEntry {
  stop: Stop;
  timestamp: number;
}

const CACHE_KEY = `stops_cache_${APP_CONSTANTS.id}`;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for the current session
const memoryCache: Record<string, Stop> = {};

// Custom names loaded from localStorage per region
const customNamesByRegion: Record<string, Record<string, string>> = {};

// Helper to normalize ID
function normalizeId(id: number | string): string {
  const s = String(id);
  if (s.includes(":")) return s;
  return `vitrasa:${s}`;
}

function getPersistentCache(): Record<string, CacheEntry> {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function savePersistentCache(cache: Record<string, CacheEntry>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

async function fetchStopsByIds(ids: string[]): Promise<Record<string, Stop>> {
  if (ids.length === 0) return {};

  const normalizedIds = ids.map(normalizeId);
  const now = Date.now();
  const persistentCache = getPersistentCache();
  const result: Record<string, Stop> = {};
  const toFetch: string[] = [];

  for (const id of normalizedIds) {
    if (memoryCache[id]) {
      result[id] = memoryCache[id];
      continue;
    }

    const cached = persistentCache[id];
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      memoryCache[id] = cached.stop;
      result[id] = cached.stop;
      continue;
    }

    toFetch.push(id);
  }

  if (toFetch.length > 0) {
    try {
      const response = await fetch(`/api/stops?ids=${toFetch.join(",")}`);
      if (!response.ok) throw new Error("Failed to fetch stops");

      const data = await response.json();
      for (const [id, stopData] of Object.entries(data)) {
        const stop: Stop = {
          stopId: (stopData as any).id,
          stopCode: (stopData as any).code,
          name: (stopData as any).name,
          lines: (stopData as any).routes.map((r: any) => ({
            line: r.shortName,
            colour: r.colour,
            textColour: r.textColour,
          })),
          type: (stopData as any).id.startsWith("renfe:")
            ? "train"
            : (stopData as any).id.startsWith("xunta:")
              ? "coach"
              : "bus",
        };

        memoryCache[id] = stop;
        result[id] = stop;
        persistentCache[id] = { stop, timestamp: now };
      }
      savePersistentCache(persistentCache);
    } catch (error) {
      console.error("Error fetching stops:", error);
    }
  }

  return result;
}

async function getStopById(stopId: string | number): Promise<Stop | undefined> {
  const id = normalizeId(stopId);
  const stops = await fetchStopsByIds([id]);
  const stop = stops[id];
  if (stop) {
    stop.favourite = isFavourite(id);
  }
  return stop;
}

function getDisplayName(stop: Stop): string {
  const custom = getCustomName(stop.stopId);
  return custom || stop.name;
}

function setCustomName(stopId: string | number, label: string) {
  const id = normalizeId(stopId);
  if (!customNamesByRegion[APP_CONSTANTS.id]) {
    const rawCustom = localStorage.getItem(
      `customStopNames_${APP_CONSTANTS.id}`
    );
    customNamesByRegion[APP_CONSTANTS.id] = rawCustom
      ? JSON.parse(rawCustom)
      : {};
  }
  customNamesByRegion[APP_CONSTANTS.id][id] = label;
  localStorage.setItem(
    `customStopNames_${APP_CONSTANTS.id}`,
    JSON.stringify(customNamesByRegion[APP_CONSTANTS.id])
  );
}

function removeCustomName(stopId: string | number) {
  const id = normalizeId(stopId);
  if (!customNamesByRegion[APP_CONSTANTS.id]) {
    const rawCustom = localStorage.getItem(
      `customStopNames_${APP_CONSTANTS.id}`
    );
    customNamesByRegion[APP_CONSTANTS.id] = rawCustom
      ? JSON.parse(rawCustom)
      : {};
  }
  if (customNamesByRegion[APP_CONSTANTS.id][id]) {
    delete customNamesByRegion[APP_CONSTANTS.id][id];
    localStorage.setItem(
      `customStopNames_${APP_CONSTANTS.id}`,
      JSON.stringify(customNamesByRegion[APP_CONSTANTS.id])
    );
  }
}

function getCustomName(stopId: string | number): string | undefined {
  const id = normalizeId(stopId);
  if (!customNamesByRegion[APP_CONSTANTS.id]) {
    const rawCustom = localStorage.getItem(
      `customStopNames_${APP_CONSTANTS.id}`
    );
    customNamesByRegion[APP_CONSTANTS.id] = rawCustom
      ? JSON.parse(rawCustom)
      : {};
  }
  return customNamesByRegion[APP_CONSTANTS.id][id];
}

function addFavourite(stopId: string | number) {
  const id = normalizeId(stopId);
  const rawFavouriteStops = localStorage.getItem(
    `favouriteStops_${APP_CONSTANTS.id}`
  );
  let favouriteStops: string[] = [];
  if (rawFavouriteStops) {
    favouriteStops = (JSON.parse(rawFavouriteStops) as (number | string)[]).map(
      normalizeId
    );
  }

  if (!favouriteStops.includes(id)) {
    favouriteStops.push(id);
    localStorage.setItem(
      `favouriteStops_${APP_CONSTANTS.id}`,
      JSON.stringify(favouriteStops)
    );
  }
}

function removeFavourite(stopId: string | number) {
  const id = normalizeId(stopId);
  const rawFavouriteStops = localStorage.getItem(
    `favouriteStops_${APP_CONSTANTS.id}`
  );
  let favouriteStops: string[] = [];
  if (rawFavouriteStops) {
    favouriteStops = (JSON.parse(rawFavouriteStops) as (number | string)[]).map(
      normalizeId
    );
  }

  const newFavouriteStops = favouriteStops.filter((sid) => sid !== id);
  localStorage.setItem(
    `favouriteStops_${APP_CONSTANTS.id}`,
    JSON.stringify(newFavouriteStops)
  );
}

function isFavourite(stopId: string | number): boolean {
  const id = normalizeId(stopId);
  const rawFavouriteStops = localStorage.getItem(
    `favouriteStops_${APP_CONSTANTS.id}`
  );
  if (rawFavouriteStops) {
    const favouriteStops = (
      JSON.parse(rawFavouriteStops) as (number | string)[]
    ).map(normalizeId);
    return favouriteStops.includes(id);
  }
  return false;
}

const RECENT_STOPS_LIMIT = 10;

function pushRecent(stopId: string | number) {
  const id = normalizeId(stopId);
  const rawRecentStops = localStorage.getItem(
    `recentStops_${APP_CONSTANTS.id}`
  );
  let recentStops: string[] = [];
  if (rawRecentStops) {
    recentStops = (JSON.parse(rawRecentStops) as (number | string)[]).map(
      normalizeId
    );
  }

  // Remove if already exists to move to front
  recentStops = recentStops.filter((sid) => sid !== id);
  recentStops.unshift(id);

  if (recentStops.length > RECENT_STOPS_LIMIT) {
    recentStops = recentStops.slice(0, RECENT_STOPS_LIMIT);
  }

  localStorage.setItem(
    `recentStops_${APP_CONSTANTS.id}`,
    JSON.stringify(recentStops)
  );
}

function getRecent(): string[] {
  const rawRecentStops = localStorage.getItem(
    `recentStops_${APP_CONSTANTS.id}`
  );
  if (rawRecentStops) {
    return (JSON.parse(rawRecentStops) as (number | string)[]).map(normalizeId);
  }
  return [];
}

function getFavouriteIds(): string[] {
  const rawFavouriteStops = localStorage.getItem(
    `favouriteStops_${APP_CONSTANTS.id}`
  );
  if (rawFavouriteStops) {
    return (JSON.parse(rawFavouriteStops) as (number | string)[]).map(
      normalizeId
    );
  }
  return [];
}

function getTileUrlTemplate(): string {
  return window.location.origin + "/api/tiles/stops/{z}/{x}/{y}";
}

export default {
  getStopById,
  fetchStopsByIds,
  getCustomName,
  getDisplayName,
  setCustomName,
  removeCustomName,
  addFavourite,
  removeFavourite,
  isFavourite,
  pushRecent,
  getRecent,
  getFavouriteIds,
  getTileUrlTemplate,
};
