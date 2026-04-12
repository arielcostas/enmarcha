using System.ComponentModel;
using System.ComponentModel.DataAnnotations.Schema;

namespace Enmarcha.Backend.Data.Models;

[Table("service_alerts")]
public class ServiceAlert
{
    public required string Id { get; set; }

    public List<AlertSelector> Selectors { get; set; } = [];

    public AlertCause Cause { get; set; }
    public AlertEffect Effect { get; set; }

    public TranslatedString Header { get; set; } = [];
    public TranslatedString Description { get; set; } = [];
    [Column("info_urls")] public List<string> InfoUrls { get; set; } = [];

    [Column("inserted_date")] public DateTime InsertedDate { get; set; }

    [Column("publish_date")] public DateTime PublishDate { get; set; }
    [Column("event_start_date")] public DateTime EventStartDate { get; set; }
    [Column("event_end_date")] public DateTime EventEndDate { get; set; }
    [Column("hidden_date")] public DateTime HiddenDate { get; set; }

    /// <summary>Incremented each time a push notification is sent for this alert.</summary>
    public int Version { get; set; } = 1;

    /// <summary>Set when a push notification was sent for the PreNotice phase.</summary>
    [Column("pre_notice_notified_at")] public DateTime? PreNoticeNotifiedAt { get; set; }

    /// <summary>Set when a push notification was sent for the Active phase.</summary>
    [Column("active_notified_at")] public DateTime? ActiveNotifiedAt { get; set; }

    public AlertPhase GetPhase(DateTime? now = null)
    {
        now ??= DateTime.UtcNow;

        if (now < PublishDate)
        {
            return AlertPhase.Draft;
        }

        if (now < EventStartDate)
        {
            return AlertPhase.PreNotice;
        }

        if (now < EventEndDate)
        {
            return AlertPhase.Active;
        }

        if (now < HiddenDate)
        {
            return AlertPhase.Finished;
        }

        return AlertPhase.Done;
    }
}

/// <summary>
/// Phases of an alert lifecycle, not standard GTFS-RT, but useful if we can display a change to the service with a notice
/// before it actually starts affecting the service. For example, if we know that a strike will start on a certain date, we can show it as "PreNotice"
/// before it starts, then "Active" while it's happening, and "Finished" after it ends but before we hide it from the system, for example with
/// a checkmark saying "everything back to normal".
/// </summary>
public enum AlertPhase
{
    Draft = -1,
    PreNotice = 0,
    Active = 1,
    Finished = 2,
    Done = 3
}

public enum AlertCause
{
    [Description("Causa desconocida")]
    UnknownCause = 1,
    [Description("Otra causa")]
    OtherCause = 2,        // Not machine-representable.
    [Description("Problema técnico")]
    TechnicalProblem = 3,
    [Description("Huelga (personal de la agencia)")]
    Strike = 4,             // Public transit agency employees stopped working.
    [Description("Manifestación (otros)")]
    Demonstration = 5,      // People are blocking the streets.
    [Description("Accidente")]
    Accident = 6,
    [Description("Festivo")]
    Holiday = 7,
    [Description("Condiciones meteorológicas")]
    Weather = 8,
    [Description("Obras en carretera (mantenimiento)")]
    Maintenance = 9,
    [Description("Obras próximas (construcción)")]
    Construction = 10,
    [Description("Intervención policial")]
    PoliceActivity = 11,
    [Description("Emergencia médica")]
    MedicalEmergency = 12
}

public enum AlertEffect
{
    [Description("Sin servicio")]
    NoService = 1,
    [Description("Servicio reducido")]
    ReducedService = 2,

    // We don't care about INsignificant delays: they are hard to detect, have
    // little impact on the user, and would clutter the results as they are too
    // frequent.
    [Description("Retrasos significativos")]
    SignificantDelays = 3,

    [Description("Desvío")]
    Detour = 4,
    [Description("Servicio adicional")]
    AdditionalService = 5,
    [Description("Servicio modificado")]
    ModifiedService = 6,
    [Description("Otro efecto")]
    OtherEffect = 7,
    [Description("Efecto desconocido")]
    UnknownEffect = 8,
    [Description("Parada movida")]
    StopMoved = 9,
    [Description("Sin efecto")]
    NoEffect = 10,
    [Description("Problemas de accesibilidad")]
    AccessibilityIssue = 11
}
