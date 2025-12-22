import {
  StopArrivalsResponseSchema,
  type StopArrivalsResponse,
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
