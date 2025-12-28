namespace Enmarcha.Backend.Helpers;

public class SortingHelper
{
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

}
