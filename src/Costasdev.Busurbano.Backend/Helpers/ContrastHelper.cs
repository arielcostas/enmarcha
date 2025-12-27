namespace Costasdev.Busurbano.Backend.Helpers;

using System;
using System.Globalization;

public static class ContrastHelper
{
    public static string GetBestTextColour(string backgroundHex)
    {
        // Strip #
        backgroundHex = backgroundHex.TrimStart('#');

        if (backgroundHex.Length != 6)
            throw new ArgumentException("Hex colour must be 6 characters (RRGGBB)");

        // Parse RGB
        int r = int.Parse(backgroundHex.Substring(0, 2), NumberStyles.HexNumber);
        int g = int.Parse(backgroundHex.Substring(2, 2), NumberStyles.HexNumber);
        int b = int.Parse(backgroundHex.Substring(4, 2), NumberStyles.HexNumber);

        // Convert to relative luminance
        double luminance = GetRelativeLuminance(r, g, b);

        // Contrast ratios
        double contrastWithWhite = (1.0 + 0.05) / (luminance + 0.05);
        double contrastWithBlack = (luminance + 0.05) / 0.05;

        if (contrastWithWhite >= 2.5)
        {
            return "#FFFFFF";
        }

        return "#000000";
    }

    private static double GetRelativeLuminance(int r, int g, int b)
    {
        double rs = r / 255.0;
        double gs = g / 255.0;
        double bs = b / 255.0;

        rs = rs <= 0.03928 ? rs / 12.92 : Math.Pow((rs + 0.055) / 1.055, 2.4);
        gs = gs <= 0.03928 ? gs / 12.92 : Math.Pow((gs + 0.055) / 1.055, 2.4);
        bs = bs <= 0.03928 ? bs / 12.92 : Math.Pow((bs + 0.055) / 1.055, 2.4);

        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }
}
