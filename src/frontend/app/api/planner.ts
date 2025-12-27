import { RoutePlanSchema, type RoutePlan } from "./schema";

export const fetchPlan = async (
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  time?: Date,
  arriveBy: boolean = false
): Promise<RoutePlan> => {
  let url = `/api/planner/plan?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}&arriveBy=${arriveBy}`;
  if (time) {
    url += `&time=${time.toISOString()}`;
  }

  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json();
  try {
    return RoutePlanSchema.parse(data);
  } catch (e) {
    console.error("Zod parsing failed for route plan:", e);
    console.log("Received data:", data);
    throw e;
  }
};
