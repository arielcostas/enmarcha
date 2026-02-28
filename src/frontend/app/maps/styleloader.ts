import type { StyleSpecification } from "react-map-gl/maplibre";
import type { Theme } from "~/AppContext";

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
  styleName: string,
  colorScheme: Theme,
  options?: StyleLoaderOptions
): Promise<StyleSpecification> {
  const { includeTraffic = true, language } = options || {};

  // Always use the light style as the single canonical base style.
  colorScheme = "light";

  if (styleName == "openfreemap") {
    const url = `/maps/styles/openfreemap-${colorScheme}.json`;

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to load style: ${url}`);
    }

    const style = await resp.json();

    // Remove traffic layers if not requested
    if (!includeTraffic) {
      style.layers = (style.layers || []).filter(
        (layer: any) => !layer.id?.startsWith("vigo_traffic")
      );
      delete style.sources?.vigo_traffic;
    }

    // Apply language-aware label expressions.
    if (language) {
      applyLanguageToStyle(style, language);
    }

    return style as StyleSpecification;
  }

  const stylePath = `/maps/styles/${styleName}-${colorScheme}.json`;
  const resp = await fetch(stylePath);

  if (!resp.ok) {
    throw new Error(`Failed to load style: ${stylePath}`);
  }

  const style = await resp.json();

  // Remove traffic layers if not requested
  if (!includeTraffic) {
    style.layers = (style.layers || []).filter(
      (layer: any) => !layer.id?.startsWith("vigo_traffic")
    );
    delete style.sources?.vigo_traffic;
  }

  const baseUrl = window.location.origin;
  const spritePath = style.sprite;

  // Handle both string and array cases for spritePath
  if (Array.isArray(spritePath)) {
    // For array format, update each sprite object's URL to be absolute
    style.sprite = spritePath.map((spriteObj) => {
      const isAbsoluteUrl =
        spriteObj.url.startsWith("http://") ||
        spriteObj.url.startsWith("https://");
      if (isAbsoluteUrl) {
        return spriteObj;
      }

      return {
        ...spriteObj,
        url: `${baseUrl}${spriteObj.url}`,
      };
    });
  } else if (typeof spritePath === "string") {
    if (
      !spritePath.startsWith("http://") &&
      !spritePath.startsWith("https://")
    ) {
      style.sprite = `${baseUrl}${spritePath}`;
    }
  }

  // Detect on each source if it the 'tiles' URLs are relative and convert them to absolute URLs
  for (const sourceKey in style.sources) {
    const source = style.sources[sourceKey];
    for (const tileKey in source.tiles) {
      const tileUrl = source.tiles[tileKey];
      const isAbsoluteUrl =
        tileUrl.startsWith("http://") || tileUrl.startsWith("https://");
      if (!isAbsoluteUrl) {
        source.tiles[tileKey] = `${baseUrl}${tileUrl}`;
      }
    }
  }

  // Remove the pseudo-3D building-top layer.
  style.layers = (style.layers || []).filter(
    (layer: any) => layer.id !== "building-top"
  );

  // Apply language-aware label expressions.
  if (language) {
    applyLanguageToStyle(style, language);
  }

  return style as StyleSpecification;
}
