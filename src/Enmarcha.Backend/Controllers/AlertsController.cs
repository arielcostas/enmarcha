using Enmarcha.Backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Backend.Controllers;

[Route("api/alerts")]
[ApiController]
public class AlertsController(AppDbContext db) : ControllerBase
{
    /// <summary>
    /// Returns all service alerts that are currently published and not yet hidden.
    /// Includes PreNotice, Active, and Finished phases.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAlerts()
    {
        var now = DateTime.UtcNow;
        var alerts = await db.ServiceAlerts
            .Where(a => a.PublishDate <= now && a.HiddenDate > now)
            .OrderByDescending(a => a.EventStartDate)
            .ToListAsync();

        return Ok(alerts.Select(a => new
        {
            id = a.Id,
            version = a.Version,
            phase = a.GetPhase(now).ToString(),
            cause = a.Cause.ToString(),
            effect = a.Effect.ToString(),
            header = (Dictionary<string, string>)a.Header,
            description = (Dictionary<string, string>)a.Description,
            selectors = a.Selectors.Select(s => s.Raw).ToList(),
            infoUrls = a.InfoUrls,
            eventStartDate = a.EventStartDate,
            eventEndDate = a.EventEndDate,
        }));
    }
}
