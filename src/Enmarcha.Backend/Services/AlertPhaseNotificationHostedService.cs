using Enmarcha.Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Backend.Services;

/// <summary>
/// Background service that automatically sends push notifications when a service alert
/// transitions into the PreNotice or Active phase without having been notified yet.
/// Runs every 60 seconds and also immediately on startup to handle any missed transitions.
/// </summary>
public class AlertPhaseNotificationHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<AlertPhaseNotificationHostedService> logger) : IHostedService, IDisposable
{
    private Timer? _timer;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Run immediately, then every 60 seconds
        _timer = new Timer(_ => _ = RunAsync(), null, TimeSpan.Zero, TimeSpan.FromSeconds(60));
        return Task.CompletedTask;
    }

    private async Task RunAsync()
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var pushService = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();

            var now = DateTime.UtcNow;

            // Find alerts that are published and not yet hidden, but haven't been notified
            // for their current phase (PreNotice: published but event not yet started;
            // Active: event in progress).
            var alertsToNotify = await db.ServiceAlerts
                .Where(a =>
                    a.PublishDate <= now && a.HiddenDate > now &&
                    (
                        // PreNotice: published, event hasn't started, no prenotice notification sent yet
                        (a.EventStartDate > now && a.PreNoticeNotifiedAt == null) ||
                        // Active: event started and not finished, no active notification sent yet
                        (a.EventStartDate <= now && a.EventEndDate > now && a.ActiveNotifiedAt == null)
                    ))
                .ToListAsync();

            if (alertsToNotify.Count == 0) return;

            logger.LogInformation("Sending push notifications for {Count} alert(s)", alertsToNotify.Count);

            foreach (var alert in alertsToNotify)
            {
                try
                {
                    await pushService.SendAlertAsync(alert);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error sending push notification for alert {AlertId}", alert.Id);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error in {ServiceName}", nameof(AlertPhaseNotificationHostedService));
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    public void Dispose() => _timer?.Dispose();
}
