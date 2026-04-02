using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Data;
using Enmarcha.Backend.Data.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json;
using WebPush;

namespace Enmarcha.Backend.Services;

public interface IPushNotificationService
{
    Task SubscribeAsync(string endpoint, string p256dh, string auth);
    Task UnsubscribeAsync(string endpoint);
    Task SendAlertAsync(ServiceAlert alert);
}

public class PushNotificationService(
    AppDbContext db,
    IOptions<AppConfiguration> options,
    ILogger<PushNotificationService> logger
) : IPushNotificationService
{
    private readonly WebPushClient? _client = BuildClient(options.Value.Vapid);

    private static WebPushClient? BuildClient(VapidConfiguration? vapid)
    {
        if (vapid is null) return null;
        var client = new WebPushClient();
        client.SetVapidDetails(vapid.Subject, vapid.PublicKey, vapid.PrivateKey);
        return client;
    }

    public async Task SubscribeAsync(string endpoint, string p256dh, string auth)
    {
        var existing = await db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint);

        if (existing is null)
        {
            db.PushSubscriptions.Add(new Data.Models.PushSubscription
            {
                Id = Guid.NewGuid(),
                Endpoint = endpoint,
                P256DhKey = p256dh,
                AuthKey = auth,
                CreatedAt = DateTime.UtcNow,
            });
        }
        else
        {
            // Refresh keys in case they changed (e.g. after re-subscription)
            existing.P256DhKey = p256dh;
            existing.AuthKey = auth;
        }

        await db.SaveChangesAsync();
    }

    public async Task UnsubscribeAsync(string endpoint)
    {
        var subscription = await db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint);

        if (subscription is not null)
        {
            db.PushSubscriptions.Remove(subscription);
            await db.SaveChangesAsync();
        }
    }

    public async Task SendAlertAsync(ServiceAlert alert)
    {
        if (_client is null)
        {
            logger.LogWarning("VAPID not configured — skipping push notification for alert {AlertId}", alert.Id);
            return;
        }

        var now = DateTime.UtcNow;
        var phase = alert.GetPhase(now);

        alert.Version++;

        if (phase == AlertPhase.PreNotice)
            alert.PreNoticeNotifiedAt = now;
        else if (phase == AlertPhase.Active)
            alert.ActiveNotifiedAt = now;

        var payload = JsonSerializer.Serialize(new
        {
            alertId = alert.Id,
            version = alert.Version,
            phase = phase.ToString(),
            cause = alert.Cause.ToString(),
            effect = alert.Effect.ToString(),
            header = (Dictionary<string, string>)alert.Header,
            description = (Dictionary<string, string>)alert.Description,
            selectors = alert.Selectors.Select(s => s.Raw).ToList(),
            eventStart = alert.EventStartDate,
            eventEnd = alert.EventEndDate,
        });

        var subscriptions = await db.PushSubscriptions.ToListAsync();
        var expired = new List<Data.Models.PushSubscription>();

        foreach (var sub in subscriptions)
        {
            try
            {
                var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256DhKey, sub.AuthKey);
                await _client.SendNotificationAsync(pushSub, payload);
            }
            catch (WebPushException ex) when (
                ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound)
            {
                // Subscription expired or was revoked — remove it
                expired.Add(sub);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to deliver push notification to endpoint {Endpoint}", sub.Endpoint[..Math.Min(40, sub.Endpoint.Length)]);
            }
        }

        if (expired.Count > 0)
        {
            db.PushSubscriptions.RemoveRange(expired);
            logger.LogInformation("Removed {Count} expired push subscription(s)", expired.Count);
        }

        await db.SaveChangesAsync();
    }
}
