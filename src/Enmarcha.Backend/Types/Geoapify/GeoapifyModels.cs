using System.Text.Json.Serialization;

namespace Enmarcha.Backend.Types.Geoapify;

public class GeoapifyResult
{
    public Result[] results { get; set; }
    public Query query { get; set; }
}

public class Result
{
    public string country_code { get; set; }
    public string? name { get; set; }
    public string street { get; set; }
    public string country { get; set; }
    public Datasource datasource { get; set; }
    public string postcode { get; set; }
    public string state { get; set; }
    public string state_code { get; set; }
    public string district { get; set; }
    public string city { get; set; }
    public string county { get; set; }
    public string county_code { get; set; }
    public double lon { get; set; }
    public double lat { get; set; }
    public string result_type { get; set; }
    public string NUTS_3 { get; set; }
    public string formatted { get; set; }
    public string address_line1 { get; set; }
    public string address_line2 { get; set; }
    public Timezone timezone { get; set; }
    public string plus_code { get; set; }
    public string iso3166_2 { get; set; }
    public string place_id { get; set; }
    public Other_names other_names { get; set; }
    public string suburb { get; set; }
    public string housenumber { get; set; }
    public string iso3166_2_sublevel { get; set; }
    public string category { get; set; }
}

public class Datasource
{
    public string sourcename { get; set; }
    public string attribution { get; set; }
    public string license { get; set; }
    public string url { get; set; }
}

public class Timezone
{
    public string name { get; set; }
    public string offset_STD { get; set; }
    public int offset_STD_seconds { get; set; }
    public string offset_DST { get; set; }
    public int offset_DST_seconds { get; set; }
    public string abbreviation_STD { get; set; }
    public string abbreviation_DST { get; set; }
}

public class Other_names
{
    public string name { get; set; }
    public string name_gl { get; set; }
    public string alt_name { get; set; }
}

public class Query
{
    public string text { get; set; }
}

