import {
  RouteDetailsSchema,
  RouteSchema,
  type Route,
  type RouteDetails,
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
