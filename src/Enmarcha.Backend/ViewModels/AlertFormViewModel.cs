using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Enmarcha.Backend.Data.Models;

namespace Enmarcha.Backend.ViewModels;

public class AlertFormViewModel
{
    public string? Id { get; set; }

    [Display(Name = "Título")]
    public string HeaderEs { get; set; } = "";

    [Display(Name = "Descripción")]
    public string DescriptionEs { get; set; } = "";

    [Display(Name = "Selectores (uno por línea)")]
    public string SelectorsRaw { get; set; } = "";

    [Display(Name = "URLs de información (una por línea)"), Required(AllowEmptyStrings = true)]
    public string InfoUrlsRaw { get; set; } = "";

    [Display(Name = "Causa")]
    public AlertCause Cause { get; set; } = AlertCause.OtherCause;

    [Display(Name = "Efecto")]
    public AlertEffect Effect { get; set; } = AlertEffect.OtherEffect;

    [DisplayFormat(DataFormatString = "{0:yyyy-MM-dd\\THH:mm}", ApplyFormatInEditMode = true)]
    [Display(Name = "Publicar desde")]
    public DateTime PublishDate { get; set; } = ToMadrid(DateTime.UtcNow);

    [DisplayFormat(DataFormatString = "{0:yyyy-MM-dd\\THH:mm}", ApplyFormatInEditMode = true)]
    [Display(Name = "Inicio del evento")]
    public DateTime EventStartDate { get; set; } = ToMadrid(DateTime.UtcNow);

    [DisplayFormat(DataFormatString = "{0:yyyy-MM-dd\\THH:mm}", ApplyFormatInEditMode = true)]
    [Display(Name = "Fin del evento")]
    public DateTime EventEndDate { get; set; } = ToMadrid(DateTime.UtcNow.AddDays(1));

    [DisplayFormat(DataFormatString = "{0:yyyy-MM-dd\\THH:mm}", ApplyFormatInEditMode = true)]
    [Display(Name = "Ocultar desde")]
    public DateTime HiddenDate { get; set; } = ToMadrid(DateTime.UtcNow.AddDays(7));

    public ServiceAlert ToServiceAlert() => new()
    {
        Id = Guid.NewGuid().ToString("N"),
        Header = ParseTranslated(HeaderEs),
        Description = ParseTranslated(DescriptionEs),
        Selectors = ParseSelectors(),
        InfoUrls = ParseLines(InfoUrlsRaw),
        Cause = Cause,
        Effect = Effect,
        InsertedDate = DateTime.UtcNow,
        PublishDate = ToUtc(PublishDate),
        EventStartDate = ToUtc(EventStartDate),
        EventEndDate = ToUtc(EventEndDate),
        HiddenDate = ToUtc(HiddenDate),
    };

    public void ApplyTo(ServiceAlert alert)
    {
        alert.Header = ParseTranslated(HeaderEs);
        alert.Description = ParseTranslated(DescriptionEs);
        alert.Selectors = ParseSelectors();
        alert.InfoUrls = ParseLines(InfoUrlsRaw);
        alert.Cause = Cause;
        alert.Effect = Effect;
        alert.PublishDate = ToUtc(PublishDate);
        alert.EventStartDate = ToUtc(EventStartDate);
        alert.EventEndDate = ToUtc(EventEndDate);
        alert.HiddenDate = ToUtc(HiddenDate);
    }

    public static AlertFormViewModel FromServiceAlert(ServiceAlert alert) => new()
    {
        Id = alert.Id,
        HeaderEs = alert.Header.GetValueOrDefault("es") ?? "",
        DescriptionEs = alert.Description.GetValueOrDefault("es") ?? "",
        SelectorsRaw = string.Join('\n', alert.Selectors.Select(s => s.Raw)),
        InfoUrlsRaw = string.Join('\n', alert.InfoUrls),
        Cause = alert.Cause,
        Effect = alert.Effect,
        PublishDate = ToMadrid(alert.PublishDate),
        EventStartDate = ToMadrid(alert.EventStartDate),
        EventEndDate = ToMadrid(alert.EventEndDate),
        HiddenDate = ToMadrid(alert.HiddenDate),
    };

    private static TranslatedString ParseTranslated(string es)
    {
        var dict = new TranslatedString();
        if (!string.IsNullOrWhiteSpace(es)) dict["es"] = es.Trim();
        return dict;
    }

    private List<AlertSelector> ParseSelectors() =>
        ParseLines(SelectorsRaw)
            .Where(s => s.Contains('#'))
            .Select(s => new AlertSelector { Raw = s })
            .ToList();

    private static List<string> ParseLines(string raw) =>
        raw.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

    private static readonly TimeZoneInfo MadridTz =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

    // Form input is "Unspecified" (local Madrid time) → convert to UTC for storage
    private static DateTime ToUtc(DateTime dt) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(dt, DateTimeKind.Unspecified), MadridTz);

    // UTC from DB → Madrid local time for display in datetime-local inputs
    private static DateTime ToMadrid(DateTime utcDt) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcDt, DateTimeKind.Utc), MadridTz);
}
