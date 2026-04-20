import {
  RouteDetailsSchema,
  RouteSchema,
  StopScheduleResponseSchema,
  type Route,
  type RouteDetails,
  type StopScheduleResponse,
} from "./schema";

export const fetchRoutes = async (feeds: string[] = []): Promise<Route[]> => {
  const params = new URLSearchParams();
  feeds.forEach((f) => params.append("feeds", f));

  const resp = await fetch(`/api/transit/routes?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json();
  return RouteSchema.array().parse(data);
};

export const fetchRouteDetails = async (
  id: string,
  date?: string
): Promise<RouteDetails> => {
  const params = new URLSearchParams();
  if (date) {
    params.set("date", date);
  }

  const query = params.toString();
  const resp = await fetch(
    `/api/transit/routes/${encodeURIComponent(id)}${query ? `?${query}` : ""}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json();
  return RouteDetailsSchema.parse(data);
};

export const fetchStopSchedule = async (
  id: string,
  date?: string
): Promise<StopScheduleResponse> => {
  const params = new URLSearchParams({ id });
  if (date) {
    params.set("date", date);
  }

  const resp = await fetch(`/api/stops/schedule?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json();
  return StopScheduleResponseSchema.parse(data);
};
