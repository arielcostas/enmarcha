namespace Enmarcha.Backend.Data.Models;

/// <summary>
/// A translatable string that can be stored in the database as a single JSON column.
/// Keys are ISO language codes (e.g., "es", "gl", "en").
/// </summary>
public class TranslatedString : Dictionary<string, string>
{
    public TranslatedString() : base() { }

    public TranslatedString(IDictionary<string, string> dictionary) : base(dictionary) { }

    /// <summary>
    /// Gets the translation for the specified language, or a fallback if not found.
    /// </summary>
    public string Get(string lang, string fallback = "es")
    {
        if (TryGetValue(lang, out var value))
            return value;

        if (TryGetValue(fallback, out var fallbackValue))
            return fallbackValue;

        return Values.FirstOrDefault() ?? string.Empty;
    }
}
