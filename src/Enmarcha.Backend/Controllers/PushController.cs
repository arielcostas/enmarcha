using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Enmarcha.Backend.Controllers;

[Route("api/push")]
[ApiController]
public class PushController(IPushNotificationService pushService, IOptions<AppConfiguration> config) : ControllerBase
{
    /// <summary>Returns the VAPID public key for the browser to use when subscribing.</summary>
    [HttpGet("vapid-public-key")]
    public IActionResult GetVapidPublicKey()
    {
        var vapid = config.Value.Vapid;
        if (vapid is null)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Push notifications are not configured on this server.");

        return Ok(new { publicKey = vapid.PublicKey });
    }

    /// <summary>Registers a new push subscription.</summary>
    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest request)
    {
        if (!Uri.TryCreate(request.Endpoint, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            return BadRequest("Invalid push endpoint: must be an absolute HTTPS URL.");

        if (string.IsNullOrWhiteSpace(request.P256Dh) || string.IsNullOrWhiteSpace(request.Auth))
            return BadRequest("Missing encryption keys.");

        await pushService.SubscribeAsync(request.Endpoint, request.P256Dh, request.Auth);
        return NoContent();
    }

    /// <summary>Removes a push subscription.</summary>
    [HttpDelete("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint))
            return BadRequest("Endpoint is required.");

        await pushService.UnsubscribeAsync(request.Endpoint);
        return NoContent();
    }
}

public record SubscribeRequest(string Endpoint, string P256Dh, string Auth);
public record UnsubscribeRequest(string Endpoint);
