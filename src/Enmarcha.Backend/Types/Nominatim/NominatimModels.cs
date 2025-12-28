using System.Text.Json.Serialization;

namespace Enmarcha.Backend.Types.Nominatim;

public class NominatimSearchResult
{
    [JsonPropertyName("place_id")]
    public long PlaceId { get; set; }

    [JsonPropertyName("licence")]
    public string? Licence { get; set; }

    [JsonPropertyName("osm_type")]
    public string? OsmType { get; set; }

    [JsonPropertyName("osm_id")]
    public long OsmId { get; set; }

    [JsonPropertyName("lat")]
    public string? Lat { get; set; }

    [JsonPropertyName("lon")]
    public string? Lon { get; set; }

    [JsonPropertyName("display_name")]
    public string? DisplayName { get; set; }

    [JsonPropertyName("address")]
    public NominatimAddress? Address { get; set; }

    [JsonPropertyName("extratags")]
    public Dictionary<string, string>? ExtraTags { get; set; }

    [JsonPropertyName("category")]
    public string? Category { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("importance")]
    public double Importance { get; set; }
}

public class NominatimAddress
{
    [JsonPropertyName("house_number")]
    public string? HouseNumber { get; set; }

    [JsonPropertyName("road")]
    public string? Road { get; set; }

    [JsonPropertyName("suburb")]
    public string? Suburb { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("municipality")]
    public string? Municipality { get; set; }

    [JsonPropertyName("county")]
    public string? County { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }

    [JsonPropertyName("postcode")]
    public string? Postcode { get; set; }

    [JsonPropertyName("country")]
    public string? Country { get; set; }

    [JsonPropertyName("country_code")]
    public string? CountryCode { get; set; }
}
