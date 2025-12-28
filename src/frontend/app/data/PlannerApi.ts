export interface PlannerSearchResult {
  name?: string;
  label?: string;
  lat: number;
  lon: number;
  layer?: string;
}

export interface RoutePlan {
  itineraries: Itinerary[];
  timeOffsetSeconds?: number;
}

export interface Itinerary {
  durationSeconds: number;
  startTime: string;
  endTime: string;
  walkDistanceMeters: number;
  walkTimeSeconds: number;
  transitTimeSeconds: number;
  waitingTimeSeconds: number;
  legs: Leg[];
  cashFare?: number;
  cashFareIsTotal?: boolean;
  cardFare?: number;
  cardFareIsTotal?: boolean;
}

export interface Leg {
  mode?: string;
  routeName?: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  routeTextColor?: string;
  headsign?: string;
  agencyName?: string;
  from?: PlannerPlace;
  to?: PlannerPlace;
  startTime: string;
  endTime: string;
  distanceMeters: number;
  geometry?: PlannerGeometry;
  steps: Step[];
  intermediateStops?: PlannerPlace[];
}

export interface PlannerPlace {
  name?: string;
  lat: number;
  lon: number;
  stopId?: string;
  stopCode?: string;
}

export interface PlannerGeometry {
  type: string;
  coordinates: number[][];
}

export interface Step {
  distanceMeters: number;
  relativeDirection?: string;
  absoluteDirection?: string;
  streetName?: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(
  query: string
): Promise<PlannerSearchResult[]> {
  const response = await fetch(
    `/api/planner/autocomplete?query=${encodeURIComponent(query)}`
  );
  if (!response.ok) return [];
  return response.json();
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<PlannerSearchResult | null> {
  const response = await fetch(`/api/planner/reverse?lat=${lat}&lon=${lon}`);
  if (!response.ok) return null;
  return response.json();
}

export async function planRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  time?: Date,
  arriveBy: boolean = false
): Promise<RoutePlan> {
  let url = `/api/planner/plan?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}&arriveBy=${arriveBy}`;
  if (time) {
    url += `&time=${time.toISOString()}`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to plan route");
  return response.json();
}
