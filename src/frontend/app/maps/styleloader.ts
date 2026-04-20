import type { StyleSpecification } from "react-map-gl/maplibre";

export interface StyleLoaderOptions {
  includeTraffic?: boolean;
  language?: string;
}

export const DEFAULT_STYLE: StyleSpecification = {
  version: 8,
  glyphs: `${window.location.origin}/maps/fonts/{fontstack}/{range}.pbf`,
  sprite: `${window.location.origin}/maps/spritesheet/sprite`,
  sources: {},
  layers: [],
};

/**
 * Builds a MapLibre text-field expression that prefers the given language.
 */
function buildLanguageTextField(language: string): unknown[] {
  const lang = language.toLowerCase().split("-")[0];
  switch (lang) {
    case "es":
      return [
        "coalesce",
        ["get", "name"],
        ["get", "name:es"],
        ["get", "name:latin"],
      ];
    case "gl":
      return [
        "coalesce",
        ["get", "name"],
        ["get", "name:gl"],
        ["get", "name:latin"],
      ];
    case "en":
      return [
        "coalesce",
        ["get", "name_en"],
        ["get", "name:latin"],
        ["get", "name"],
      ];
    default:
      return ["coalesce", ["get", "name:latin"], ["get", "name"]];
  }
}

/**
 * Returns true for text-field expressions that encode multi-language name
 * logic (they reference name:latin or name_en). These are the label layers
 * produced by OpenMapTiles / OpenFreeMap that need localisation.
 */
function isMultiLanguageTextField(textField: unknown): boolean {
  if (!Array.isArray(textField)) return false;
  const str = JSON.stringify(textField);
  return str.includes('"name:latin"') || str.includes('"name_en"');
}

/**
 * Mutates the loaded style to replace multi-language label expressions with
 * a localised version appropriate for the given language code.
 */
function applyLanguageToStyle(style: any, language: string): void {
  const newTextField = buildLanguageTextField(language);
  for (const layer of style.layers ?? []) {
    if (
      layer.layout?.["text-field"] &&
      isMultiLanguageTextField(layer.layout["text-field"])
    ) {
      layer.layout["text-field"] = newTextField;
    }
  }
}

export async function loadStyle(
  options?: StyleLoaderOptions
): Promise<StyleSpecification> {
  const url = `/maps/styles/openfreemap-light.json`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load style: ${url}`);
  }

  const style = (await resp.json()) as StyleSpecification;

  if (options?.includeTraffic) {
    style.sources["vigo_traffic"] = {
      type: "vector",
      tiles: [`https://enmarcha.app/tiles/vigo-traffic/{z}/{x}/{y}.pbf`],
      minzoom: 7,
      maxzoom: 18,
      bounds: [-8.774113, 42.175803, -8.632514, 42.259719],
    };

    style.layers.push({
      id: "vigo_traffic",
      type: "line",
      source: "vigo_traffic",
      "source-layer": "trafico_vigo_latest",
      layout: {},
      filter: ["!=", ["get", "style"], "#SINDATOS"],
      paint: {
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["get", "zoom"],
          0,
          11,
          14,
          1,
          16,
          0.8,
          18,
          0.6,
          22,
          0.6,
        ],
        "line-color": [
          "match",
          ["get", "style"],
          "#CONGESTION",
          "hsl(70.7 100% 38%)",
          "#MUYDENSO",
          "hsl(36.49 100% 50%)",
          "#DENSO",
          "hsl(47.61 100% 49%)",
          "#FLUIDO",
          "hsl(83.9 100% 40%)",
          "#MUYFLUIDO",
          "hsl(161.25 100% 42%)",
          "hsl(0.0 0% 0%)",
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 18, 4],
      },
    });
  }

  if (options?.language) {
    applyLanguageToStyle(style, options.language);
  }

  return style as StyleSpecification;
}
