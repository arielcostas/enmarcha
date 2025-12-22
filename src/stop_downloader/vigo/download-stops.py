# /// script
# requires-python = ">=3.12"
# dependencies = [
#    "PyYAML>=6.0.2",  # For YAML support
# ]
# ///
import csv
import json
import os
import sys
import urllib.request
import yaml  # Add YAML support for overrides

OVERRIDES_DIR = "overrides"
OUTPUT_FILE = "../../frontend/public/stops/vigo.json"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_stop_overrides(file_path):
    """Load stop overrides from a YAML file"""
    if not os.path.exists(file_path):
        print(f"Warning: Overrides file {file_path} not found")
        return {}

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            overrides = yaml.safe_load(f)
            print(f"Loaded {len(overrides) if overrides else 0} stop overrides")
            return overrides or {}
    except Exception as e:
        print(f"Error loading overrides: {e}", file=sys.stderr)
        return {}


def apply_overrides(stops, overrides):
    """Apply overrides to the stop data and add new stops"""
    # Track existing stop IDs
    existing_stop_ids = {stop.get("stopId") for stop in stops}

    # Apply overrides to existing stops
    for stop in stops:
        stop_id = stop.get("stopId")
        if stop_id in overrides:
            override = overrides[stop_id]

            # Override name if provided
            if "name" in override:
                stop["name"] = override["name"]

            # Apply or add alternate names
            if "alternateNames" in override:
                for key, value in override["alternateNames"].items():
                    stop["name"][key] = value

            # Apply location override
            if "location" in override:
                if "latitude" in override["location"]:
                    stop["latitude"] = override["location"]["latitude"]
                if "longitude" in override["location"]:
                    stop["longitude"] = override["location"]["longitude"]

            # Add amenities
            if "amenities" in override:
                stop["amenities"] = override["amenities"]

            # Mark stop as hidden if needed
            if "hide" in override:
                stop["hide"] = override["hide"]

            # Mark stop as cancelled
            if "cancelled" in override:
                stop["cancelled"] = override["cancelled"]

            if "alert" in override:
                stop["alert"] = override["alert"]

            if "title" in override:
                stop["title"] = override["title"]

            if "message" in override:
                stop["message"] = override["message"]

    # Add new stops (those with "new: true" parameter)
    new_stops_added = 0
    for stop_id, override in overrides.items():
        # Check if this is a new stop
        if override.get("new") and stop_id not in existing_stop_ids:
            # Ensure stop_id is an integer for consistency
            stop_id_int = int(stop_id) if isinstance(stop_id, str) else stop_id

            # Create the new stop
            new_stop = {
                "stopId": stop_id_int,
                "name": override.get("name", f"Stop {stop_id_int}"),
                "latitude": override.get("location", {}).get("latitude"),
                "longitude": override.get("location", {}).get("longitude"),
                "lines": override.get("lines", []),
            }

            # Add optional fields (excluding the 'new' parameter)
            if "alternateNames" in override:
                for key, value in override["alternateNames"].items():
                    new_stop["name"][key] = value
            if "amenities" in override:
                new_stop["amenities"] = override["amenities"]
            if "cancelled" in override:
                new_stop["cancelled"] = override["cancelled"]
            if "title" in override:
                new_stop["title"] = override["title"]
            if "message" in override:
                new_stop["message"] = override["message"]
            if "alternateCodes" in override:
                new_stop["alternateCodes"] = override["alternateCodes"]

            stops.append(new_stop)
            new_stops_added += 1

    if new_stops_added > 0:
        print(f"Added {new_stops_added} new stops from overrides")

    return stops


def download_stops_vitrasa() -> list[dict]:
    url = "https://datos.vigo.org/vci_api_app/api2.jsp?tipo=TRANSPORTE_PARADAS"
    req = urllib.request.Request(url)

    try:
        with urllib.request.urlopen(req) as response:
            # Read the response and decode from ISO-8859-1 to UTF-8
            content = response.read().decode("iso-8859-1")
            data = json.loads(content)

        print(f"Downloaded {len(data)} stops")

        # Process the data
        processed_stops = []
        for stop in data:
            name = stop.get("nombre", "").strip()
            # Fix double space equals comma-space: "Castrelos  202" -> "Castrelos, 202"; and remove quotes
            name = name.replace("  ", ", ").replace('"', "").replace("'", "")

            processed_stop = {
                "stopId": "vitrasa:" + str(stop.get("id")),
                "name": name,
                "latitude": stop.get("lat"),
                "longitude": stop.get("lon"),
                "lines": [line.strip() for line in stop.get("lineas", "").split(",")]
                if stop.get("lineas")
                else [],
            }
            processed_stops.append(processed_stop)

        return processed_stops
    except Exception as e:
        print(f"Error processing vigo stops data: {e}", file=sys.stderr)
        return []


def download_stops_renfe() -> list[dict]:
    url = "https://data.renfe.com/dataset/1146f3f1-e06d-477c-8f74-84f8d0668cf9/resource/b22cd560-3a2b-45dd-a25d-2406941f6fcc/download/listado_completo_av_ld_md.csv"
    req = urllib.request.Request(url)

    # CÓDIGO;DESCRIPCION;LATITUD;LONGITUD;DIRECCIÓN;C.P.;POBLACION;PROVINCIA;PAIS

    try:
        with urllib.request.urlopen(req) as response:
            content = response.read()
            data = csv.DictReader(
                content.decode("utf-8").splitlines(),
                delimiter=";",
                fieldnames=[
                    "CODE",
                    "NAME",
                    "LAT",
                    "LNG",
                    "ADDRESS",
                    "ZIP",
                    "CITY",
                    "PROVINCE",
                    "COUNTRY",
                ],
            )

        stops = [row for row in data]

        print(f"Downloaded {len(stops)} stops")

        # Process the data
        processed_stops = []
        for stop in stops:
            if stop.get("PROVINCE") != "Pontevedra":
                continue

            name = stop.get("NAME", "").strip()

            processed_stop = {
                "stopId": "renfe:" + str(stop.get("CODE", 0)),
                "name": name,
                "latitude": float(stop.get("LAT", 0).replace(",", ".")),
                "longitude": float(stop.get("LNG", 0).replace(",", ".")),
                "lines": [],
            }
            processed_stops.append(processed_stop)

        print(f"Processed {len(processed_stops)} Renfe stops in Pontevedra")
        return processed_stops
    except Exception as e:
        print(f"Error processing Pontevedra stops data: {e}", file=sys.stderr)
        return []


def main():
    print("Fetching stop list data...")

    vigo_stops = download_stops_vitrasa()
    renfe_stops = download_stops_renfe()

    all_stops = vigo_stops + (renfe_stops if renfe_stops else [])

    try:
        # Load and apply overrides
        overrides_dir = os.path.join(SCRIPT_DIR, OVERRIDES_DIR)
        # For each YML/YAML file in the overrides directory, load and apply the overrides
        for filename in os.listdir(overrides_dir):
            if not filename.endswith(".yml") and not filename.endswith(".yaml"):
                continue

            print(f"Loading overrides from {filename}")
            overrides_file = os.path.join(overrides_dir, filename)
            overrides = load_stop_overrides(overrides_file)
            all_stops = apply_overrides(all_stops, overrides)

        # Filter out hidden stops
        visible_stops = [stop for stop in all_stops if not stop.get("hide")]
        print(f"Removed {len(all_stops) - len(visible_stops)} hidden stops")

        # Sort stops by ID ascending
        visible_stops.sort(key=lambda x: x["stopId"])

        output_file = os.path.join(SCRIPT_DIR, OUTPUT_FILE)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(visible_stops, f, ensure_ascii=False, indent=2)

        print(f"Saved processed stops data to {output_file}")
        return 0

    except Exception as e:
        print(f"Error processing stops data: {e}", file=sys.stderr)
        # Print full exception traceback
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
