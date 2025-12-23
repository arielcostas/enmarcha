import type { LngLatLike } from "maplibre-gl";

export type RegionId = "vigo";

export const APP_CONSTANTS = {
  id: "vigo",

  stopsEndpoint: "/stops/vigo.json",
  consolidatedCirculationsEndpoint: "/api/vigo/GetConsolidatedCirculations",
  shapeEndpoint: "/api/vigo/GetShape",
  defaultCenter: {
    lat: 42.229188855975046,
    lng: -8.72246955783102,
  } as LngLatLike,
  bounds: {
    sw: [-16, 36] as LngLatLike,
    ne: [2, 45.5] as LngLatLike,
  },
  textColour: "#e72b37",
  defaultZoom: 14,
  showMeters: true,
};
