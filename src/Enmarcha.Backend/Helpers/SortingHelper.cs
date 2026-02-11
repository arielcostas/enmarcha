namespace Enmarcha.Backend.Helpers;

public class SortingHelper
{
    /// <summary>
    /// Generic route short name comparison. Non-numeric names sort first, then numeric by value,
    /// then alphabetical tiebreak. Used for per-stop sorting where route IDs may not be available.
    /// </summary>
    public static int SortRouteShortNames(string? a, string? b)
    {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;

        var aDigits = new string(a.Where(char.IsDigit).ToArray());
        var bDigits = new string(b.Where(char.IsDigit).ToArray());

        bool aHasDigits = int.TryParse(aDigits, out int aNumber);
        bool bHasDigits = int.TryParse(bDigits, out int bNumber);

        if (aHasDigits != bHasDigits)
        {
            // Non-numeric routes (like "A" or "-") go to the beginning
            return aHasDigits ? 1 : -1;
        }

        if (aHasDigits && bHasDigits)
        {
            if (aNumber != bNumber)
            {
                return aNumber.CompareTo(bNumber);
            }
        }

        // If both are non-numeric, or numeric parts are equal, use alphabetical
        return string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Feed-aware route sort key. For Vitrasa, applies custom group ordering:
    /// Circular (C*) → Regular numbered → Hospital (H*) → Others (N*, PSA*, U*, specials).
    /// For other feeds, uses generic numeric-then-alphabetic ordering.
    /// </summary>
    public static (int Group, string Prefix, int Number, string Name) GetRouteSortKey(
        string? shortName, string? routeId)
    {
        if (string.IsNullOrEmpty(shortName))
            return (99, "", int.MaxValue, shortName ?? "");

        var feed = routeId?.Split(':')[0];

        if (feed == "vitrasa")
        {
            int group = GetVitrasaRouteGroup(shortName);
            // For "Others" group, sub-sort by alphabetic prefix to keep N*, PSA*, U* etc. grouped
            string prefix = group == 3 ? ExtractAlphaPrefix(shortName) : "";
            int number = ExtractNumber(shortName);

            // For routes with no number in short name (like "A"), use the GTFS route ID number
            if (number == int.MaxValue && routeId != null)
            {
                var idPart = routeId.Split(':').Last();
                if (int.TryParse(idPart, out int idNumber))
                    number = idNumber;
            }

            return (group, prefix, number, shortName);
        }

        // Generic: non-numeric names first, then by number, then alphabetical
        int genericNumber = ExtractNumber(shortName);
        bool hasDigits = genericNumber != int.MaxValue;
        return (hasDigits ? 1 : 0, "", genericNumber, shortName);
    }

    /// <summary>
    /// Vitrasa route groups:
    /// 0 = Circular (C1, C3d, C3i)
    /// 1 = Regular numbered routes (4A, 6, 10, A, etc.)
    /// 2 = Hospital (H, H1, H2, H3)
    /// 3 = Others (N*, PSA*, U*, LZD, PTL)
    /// </summary>
    private static int GetVitrasaRouteGroup(string shortName)
    {
        // Circular: "C" followed by a digit
        if (shortName.Length > 1 && shortName[0] == 'C' && char.IsDigit(shortName[1]))
            return 0;

        // Hospital: starts with "H"
        if (shortName[0] == 'H')
            return 2;

        // Night: "N" followed by a digit
        if (shortName[0] == 'N' && shortName.Length > 1 && char.IsDigit(shortName[1]))
            return 3;

        // PSA shuttle lines
        if (shortName.StartsWith("PSA", StringComparison.OrdinalIgnoreCase))
            return 3;

        // University: "U" followed by a digit
        if (shortName[0] == 'U' && shortName.Length > 1 && char.IsDigit(shortName[1]))
            return 3;

        // Multi-letter codes with no digits (LZD, PTL)
        if (shortName.Length >= 2 && shortName.All(char.IsLetter))
            return 3;

        // Everything else is regular (numbered routes like 4A, 6, 10, single letters like A)
        return 1;
    }

    private static int ExtractNumber(string name)
    {
        var digits = new string(name.Where(char.IsDigit).ToArray());
        return int.TryParse(digits, out int number) ? number : int.MaxValue;
    }

    private static string ExtractAlphaPrefix(string name)
    {
        return new string(name.TakeWhile(char.IsLetter).ToArray());
    }
}
