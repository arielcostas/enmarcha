import { APP_CONSTANTS } from "~/config/constants";

export interface CachedStopList {
  timestamp: number;
  data: Stop[];
}

export interface Stop {
  stopId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  lines: string[];
  favourite?: boolean;
  amenities?: string[];

  title?: string;
  message?: string;
  alert?: "info" | "warning" | "error";
  cancelled?: boolean;
}

// In-memory cache and lookup map per region
const cachedStopsByRegion: Record<string, Stop[] | null> = {};
const stopsMapByRegion: Record<string, Record<string, Stop>> = {};
// Custom names loaded from localStorage per region
const customNamesByRegion: Record<string, Record<string, string>> = {};

// Helper to normalize ID
function normalizeId(id: number | string): string {
  const s = String(id);
  if (s.includes(":")) return s;
  return `vitrasa:${s}`;
}

// Initialize cachedStops and customNames once per region
async function initStops() {
  if (!cachedStopsByRegion[APP_CONSTANTS.id]) {
    const response = await fetch(APP_CONSTANTS.stopsEndpoint);
    const rawStops = (await response.json()) as any[];

    // build array and map
    stopsMapByRegion[APP_CONSTANTS.id] = {};
    cachedStopsByRegion[APP_CONSTANTS.id] = rawStops.map((raw) => {
      const id = normalizeId(raw.stopId);
      const entry = {
        ...raw,
        stopId: id,
        type: raw.type || (id.startsWith("renfe:") ? "train" : "bus"),
        favourite: false,
      } as Stop;
      stopsMapByRegion[APP_CONSTANTS.id][id] = entry;
      return entry;
    });

    // load custom names
    const rawCustom = localStorage.getItem(
      `customStopNames_${APP_CONSTANTS.id}`
    );
    if (rawCustom) {
      const parsed = JSON.parse(rawCustom);
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        normalized[normalizeId(key)] = value as string;
      }
      customNamesByRegion[APP_CONSTANTS.id] = normalized;
    } else {
      customNamesByRegion[APP_CONSTANTS.id] = {};
    }
  }
}

async function getStops(): Promise<Stop[]> {
  await initStops();
  // update favourites
  const rawFav = localStorage.getItem("favouriteStops");
  const favouriteStops = rawFav
    ? (JSON.parse(rawFav) as (number | string)[]).map(normalizeId)
    : [];

  cachedStopsByRegion["vigo"]!.forEach(
    (stop) => (stop.favourite = favouriteStops.includes(stop.stopId))
  );
  return cachedStopsByRegion["vigo"]!;
}

// New: get single stop by id
async function getStopById(stopId: string | number): Promise<Stop | undefined> {
  await initStops();
  const id = normalizeId(stopId);
  const stop = stopsMapByRegion[APP_CONSTANTS.id]?.[id];
  if (stop) {
    const rawFav = localStorage.getItem(`favouriteStops_${APP_CONSTANTS.id}`);
    const favouriteStops = rawFav
      ? (JSON.parse(rawFav) as (number | string)[]).map(normalizeId)
      : [];
    stop.favourite = favouriteStops.includes(id);
  }
  return stop;
}

// Updated display name to include custom names
function getDisplayName(stop: Stop): string {
  return stop.name;
}

// New: set or remove custom names
function setCustomName(stopId: string | number, label: string) {
  const id = normalizeId(stopId);
  if (!customNamesByRegion[APP_CONSTANTS.id]) {
    customNamesByRegion[APP_CONSTANTS.id] = {};
  }
  customNamesByRegion[APP_CONSTANTS.id][id] = label;
  localStorage.setItem(
    `customStopNames_${APP_CONSTANTS.id}`,
    JSON.stringify(customNamesByRegion[APP_CONSTANTS.id])
  );
}

function removeCustomName(stopId: string | number) {
  const id = normalizeId(stopId);
  if (customNamesByRegion[APP_CONSTANTS.id]?.[id]) {
    delete customNamesByRegion[APP_CONSTANTS.id][id];
    localStorage.setItem(
      `customStopNames_${APP_CONSTANTS.id}`,
      JSON.stringify(customNamesByRegion[APP_CONSTANTS.id])
    );
  }
}

// New: get custom label for a stop
function getCustomName(stopId: string | number): string | undefined {
  const id = normalizeId(stopId);
  return customNamesByRegion[APP_CONSTANTS.id]?.[id];
}

function addFavourite(stopId: string | number) {
  const id = normalizeId(stopId);
  const rawFavouriteStops = localStorage.getItem(`favouriteStops`);
  let favouriteStops: string[] = [];
  if (rawFavouriteStops) {
    favouriteStops = (JSON.parse(rawFavouriteStops) as (number | string)[]).map(
      normalizeId
    );
  }

  if (!favouriteStops.includes(id)) {
    favouriteStops.push(id);
    localStorage.setItem(`favouriteStops`, JSON.stringify(favouriteStops));
  }
}

function removeFavourite(stopId: string | number) {
  const id = normalizeId(stopId);
  const rawFavouriteStops = localStorage.getItem(`favouriteStops`);
  let favouriteStops: string[] = [];
  if (rawFavouriteStops) {
    favouriteStops = (JSON.parse(rawFavouriteStops) as (number | string)[]).map(
      normalizeId
    );
  }

  const newFavouriteStops = favouriteStops.filter((sid) => sid !== id);
  localStorage.setItem(`favouriteStops`, JSON.stringify(newFavouriteStops));
}

function isFavourite(stopId: string | number): boolean {
  const id = normalizeId(stopId);
  const rawFavouriteStops = localStorage.getItem(`favouriteStops`);
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
  const rawRecentStops = localStorage.getItem(`recentStops_vigo`);
  let recentStops: Set<string> = new Set();
  if (rawRecentStops) {
    recentStops = new Set(
      (JSON.parse(rawRecentStops) as (number | string)[]).map(normalizeId)
    );
  }

  recentStops.add(id);
  if (recentStops.size > RECENT_STOPS_LIMIT) {
    const iterator = recentStops.values();
    const val = iterator.next().value as string;
    recentStops.delete(val);
  }

  localStorage.setItem(
    `recentStops_vigo`,
    JSON.stringify(Array.from(recentStops))
  );
}

function getRecent(): string[] {
  const rawRecentStops = localStorage.getItem(`recentStops_vigo`);
  if (rawRecentStops) {
    return (JSON.parse(rawRecentStops) as (number | string)[]).map(normalizeId);
  }
  return [];
}

function getFavouriteIds(): string[] {
  const rawFavouriteStops = localStorage.getItem(`favouriteStops`);
  if (rawFavouriteStops) {
    return (JSON.parse(rawFavouriteStops) as (number | string)[]).map(
      normalizeId
    );
  }
  return [];
}

// New function to load stops from network
async function loadStopsFromNetwork(): Promise<Stop[]> {
  const response = await fetch(APP_CONSTANTS.stopsEndpoint);
  const rawStops = (await response.json()) as any[];
  return rawStops.map((raw) => {
    const id = normalizeId(raw.stopId);
    return {
      ...raw,
      stopId: id,
      type: raw.type || (id.startsWith("renfe:") ? "train" : "bus"),
      favourite: false,
    } as Stop;
  });
}

function getTileUrlTemplate(): string {
  return window.location.origin + "/api/tiles/stops/{z}/{x}/{y}";
}

export default {
  getStops,
  getStopById,
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
  loadStopsFromNetwork,
  getTileUrlTemplate,
};
