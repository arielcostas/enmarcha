using System.ComponentModel.DataAnnotations.Schema;

namespace Enmarcha.Backend.Data.Models;

[Table("push_subscriptions")]
public class PushSubscription
{
    public Guid Id { get; set; }

    /// <summary>Push endpoint URL provided by the browser's push service.</summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>P-256 DH public key for payload encryption (base64url).</summary>
    [Column("p256dh_key")] public string P256DhKey { get; set; } = string.Empty;

    /// <summary>Auth secret for payload encryption (base64url).</summary>
    [Column("auth_key")] public string AuthKey { get; set; } = string.Empty;

    [Column("created_at")] public DateTime CreatedAt { get; set; }
}
