import {
  StopArrivalsResponseSchema,
  StopEstimatesResponseSchema,
  type StopArrivalsResponse,
  type StopEstimatesResponse,
} from "./schema";

export const fetchArrivals = async (
  stopId: string,
  reduced: boolean = false
): Promise<StopArrivalsResponse> => {
  const resp = await fetch(
    `/api/stops/arrivals?id=${stopId}&reduced=${reduced}`,
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
  try {
    return StopArrivalsResponseSchema.parse(data);
  } catch (e) {
    console.error("Zod parsing failed for arrivals:", e);
    console.log("Received data:", data);
    throw e;
  }
};

export const fetchEstimates = async (
  stopId: string,
  routeId: string,
  viaStopId?: string
): Promise<StopEstimatesResponse> => {
  let url = `/api/stops/estimates?stop=${encodeURIComponent(stopId)}&route=${encodeURIComponent(routeId)}`;
  if (viaStopId) {
    url += `&via=${encodeURIComponent(viaStopId)}`;
  }

  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json();
  try {
    return StopEstimatesResponseSchema.parse(data);
  } catch (e) {
    console.error("Zod parsing failed for estimates:", e);
    console.log("Received data:", data);
    throw e;
  }
};
