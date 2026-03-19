using Enmarcha.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Enmarcha.Backend.Controllers.Backoffice;

[Route("backoffice/api")]
[Authorize(AuthenticationSchemes = "Backoffice")]
public class AlertsApiController(BackofficeSelectorService selectors) : ControllerBase
{
    [HttpGet("selectors/transit")]
    public async Task<IActionResult> GetTransit() =>
        Ok(await selectors.GetTransitDataAsync());
}
