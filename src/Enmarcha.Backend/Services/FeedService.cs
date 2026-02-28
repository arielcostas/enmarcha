using System.Text.RegularExpressions;
using Enmarcha.Backend.Types.Arrivals;

namespace Enmarcha.Backend.Services;

public class FeedService
{
    private static readonly Regex RemoveQuotationMarks = new(@"[""”]", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex StreetNameRegex = new(@"^(.*?)(?:,|\s\s|\s-\s| \d| S\/N|\s\()", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Dictionary<string, string> NameReplacements = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Rúa da Salguera Entrada", "Rúa da Salgueira" },
        { "Rúa da Salgueira Entrada", "Rúa da Salgueira" },
        { "Estrada de Miraflores", "Estrada Miraflores" },
        { "Avda. de Europa", "Avda. Europa" },
        { "Avda. de Galicia", "Avda. Galicia" },
        { "Avda. de Vigo", "Avda. Vigo" },
        { "FORA DE SERVIZO.G.B.", "" },
        { "Praza de Fernando O Católico", "" },
        { "Rúa da Travesía de Vigo", "Travesía de Vigo" },
        { "Rúa de ", " " },
        { "Rúa do ", " " },
        { "Rúa da ", " " },
        { "Rúa das ", " " },
        { "Avda. de ", " " },
        { "Avda. do ", " " },
        { "Avda. da ", " " },
        { "Avda. das ", " " },
        { "Riós", "Ríos" },
        { "Avda. Beiramar Porto Pesqueiro Berbés", "Berbés" },
        { "Conde de Torrecedeira", "Torrecedeira" },

    };

    public (string Color, string TextColor) GetFallbackColourForFeed(string feed)
    {
        return feed switch
        {
            "vitrasa" => ("#81D002", "#000000"),
            "tussa" => ("#508096", "#FFFFFF"),
            "tranvias" => ("#E61C29", "#FFFFFF"),
            "xunta" => ("#007BC4", "#FFFFFF"),
            "renfe" => ("#870164", "#FFFFFF"),
            "feve" => ("#EE3D32", "#FFFFFF"),
            _ => ("#000000", "#FFFFFF"),
        };
    }

    public string NormalizeStopCode(string feedId, string code)
    {
        if (feedId == "vitrasa")
        {
            var digits = new string(code.Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out int numericCode))
            {
                return numericCode.ToString();
            }
        }
        return code;
    }

    public string NormalizeRouteShortName(string feedId, string shortName)
    {
        if (feedId == "xunta" && shortName.StartsWith("XG"))
        {
            if (shortName.Length >= 8)
            {
                // XG817014 -> 817.14
                var contract = shortName.Substring(2, 3);
                var lineStr = shortName.Substring(5);
                if (int.TryParse(lineStr, out int line))
                {
                    return $"{contract}.{line:D2}";
                }
            }
            else if (shortName.Length > 2)
            {
                // XG883 -> 883
                return shortName.Substring(2);
            }
        }
        return shortName;
    }

    public string GetUniqueRouteShortName(string feedId, string shortName)
    {
        if (feedId == "xunta" && shortName.StartsWith("XG") && shortName.Length >= 8)
        {
            var contract = shortName.Substring(2, 3);
            return $"XG{contract}";
        }

        return NormalizeRouteShortName(feedId, shortName);
    }

    /// <summary>
    /// When 5 or more distinct routes share the same 3-character short-name prefix,
    /// they are collapsed into a single entry showing "XG{prefix}" (xunta feed only).
    /// </summary>
    private const int RouteCollapseThreshold = 5;

    /// <summary>
    /// Deduplicates routes by <see cref="RouteInfo.ShortName"/> (always). For the xunta feed only,
    /// also collapses groups of <see cref="RouteCollapseThreshold"/> or more routes that share the
    /// same 3-character prefix into a single entry named "XG{prefix}" (e.g. "XG621").
    /// Other feeds are returned deduplicated but otherwise unchanged.
    /// </summary>
    public List<RouteInfo> ConsolidateRoutes(string feedId, IEnumerable<RouteInfo> routes)
    {
        // Deduplicate by short name (case-insensitive)
        var deduplicated = routes
            .GroupBy(r => r.ShortName, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        // Prefix collapsing only applies to xunta routes, which can have dozens of
        // sub-routes per contract that would otherwise flood the badge list.
        if (feedId != "xunta")
        {
            return deduplicated;
        }

        // Group by the first 3 characters; collapse groups meeting the threshold.
        // When collapsing, the first entry's colour is used — routes in the same prefix
        // group (e.g. all xunta "621.*" lines) share the same operator colour.
        var result = new List<RouteInfo>();
        foreach (var group in deduplicated.GroupBy(r => r.ShortName.Length >= 3 ? r.ShortName[..3] : r.ShortName))
        {
            var items = group.ToList();
            if (items.Count >= RouteCollapseThreshold)
            {
                result.Add(new RouteInfo
                {
                    GtfsId = items[0].GtfsId,
                    ShortName = $"XG{group.Key}",
                    Colour = items[0].Colour,
                    TextColour = items[0].TextColour
                });
            }
            else
            {
                result.AddRange(items);
            }
        }

        return result;
    }

    public string NormalizeStopName(string feedId, string name)
    {
        if (feedId == "vitrasa")
        {
            return name
                .Trim()
                .Replace("\"", "")
                .Replace("  ", ", ")
                .Trim();
        }

        return name;
    }

    public string NormalizeRouteNameForMatching(string name)
    {
        var normalized = name.Trim().ToLowerInvariant();
        // Remove diacritics/accents
        normalized = Regex.Replace(normalized.Normalize(System.Text.NormalizationForm.FormD), @"\p{Mn}", "");
        // Keep only alphanumeric
        return Regex.Replace(normalized, @"[^a-z0-9]", "");
    }

    public string GetStreetName(string originalName)
    {
        var name = RemoveQuotationMarks.Replace(originalName, "").Trim();
        var match = StreetNameRegex.Match(name);
        var streetName = match.Success ? match.Groups[1].Value : name;

        foreach (var replacement in NameReplacements)
        {
            if (streetName.Contains(replacement.Key, StringComparison.OrdinalIgnoreCase))
            {
                streetName = streetName.Replace(replacement.Key, replacement.Value, StringComparison.OrdinalIgnoreCase);
                return streetName.Trim();
            }
        }

        return streetName.Trim();
    }

    public string? GenerateMarquee(string feedId, List<string> nextStops)
    {
        if (nextStops.Count == 0) return null;

        if (feedId is "vitrasa" or "tranvias" or "tussa")
        {
            var streets = nextStops
                .Select(GetStreetName)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct()
                .ToList();

            return string.Join(" - ", streets);
        }

        return feedId switch
        {
            "xunta" => string.Join(" > ", nextStops),
            _ => string.Join(", ", nextStops.Take(4))
        };
    }

    public bool IsStopHidden(string stopId)
    {
        return HiddenStops.Contains(stopId);
    }

    public ShiftBadge? GetShiftBadge(string feedId, string tripId)
    {
        if (feedId != "vitrasa") return null;

        // Example: C1 04LN 02_001004_4
        var parts = tripId.Split('_');
        if (parts.Length < 2) return null;

        var shiftGroup = parts[parts.Length - 2]; // 001004
        var tripNumber = parts[parts.Length - 1]; // 4

        if (shiftGroup.Length != 6) return null;

        if (!int.TryParse(shiftGroup.Substring(0, 3), out var routeNum)) return null;
        if (!int.TryParse(shiftGroup.Substring(3, 3), out var shiftNum)) return null;

        var routeName = routeNum switch
        {
            1 => "C1",
            3 => "C3",
            30 => "N1",
            33 => "N4",
            8 => "A",
            101 => "H",
            201 => "U1",
            202 => "U2",
            150 => "REF",
            500 => "TUR",
            _ => $"L{routeNum}"
        };

        return new ShiftBadge
        {
            ShiftName = $"{routeName}-{shiftNum}",
            ShiftTrip = tripNumber
        };
    }

    private static readonly string[] HiddenStops =
    [
        "vitrasa:20223", // Castrelos (Pavillón - U1)
        "vitrasa:20146", // García Barbón, 7 (A, 18A)
        "vitrasa:20220", // COIA-SAMIL (15)
        "vitrasa:20001", // Samil por Beiramar (15B)
        "vitrasa:20002", // Samil por Torrecedeira (15C)
        "vitrasa:20144", // Samil por Coia (C3d, C3i)
        "vitrasa:20145"  // Samil por Bouzs (C3d, C3i)
    ];
}
