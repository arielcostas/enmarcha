using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Enmarcha.Backend.Data.Models;
using System.Text.Json;

namespace Enmarcha.Backend.Data;

public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<ServiceAlert> ServiceAlerts { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Rename Identity tables to snake_case for PostgreSQL
        builder.Entity<IdentityUser>(b => b.ToTable("users"));
        builder.Entity<IdentityRole>(b => b.ToTable("roles"));
        builder.Entity<IdentityUserRole<string>>(b => b.ToTable("user_roles"));
        builder.Entity<IdentityUserClaim<string>>(b => b.ToTable("user_claims"));
        builder.Entity<IdentityUserLogin<string>>(b => b.ToTable("user_logins"));
        builder.Entity<IdentityRoleClaim<string>>(b => b.ToTable("role_claims"));
        builder.Entity<IdentityUserToken<string>>(b => b.ToTable("user_tokens"));

        // ServiceAlert configuration
        builder.Entity<ServiceAlert>(b =>
        {
            b.HasKey(x => x.Id);

            static ValueComparer<T> JsonComparer<T>() where T : class => new(
                (x, y) => JsonSerializer.Serialize(x, (JsonSerializerOptions?)null) ==
                           JsonSerializer.Serialize(y, (JsonSerializerOptions?)null),
                c => JsonSerializer.Serialize(c, (JsonSerializerOptions?)null).GetHashCode(),
                c => JsonSerializer.Deserialize<T>(
                    JsonSerializer.Serialize(c, (JsonSerializerOptions?)null),
                    (JsonSerializerOptions?)null)!);

            // Store Selectors as JSONB
            b.Property(x => x.Selectors)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<AlertSelector>>(v, (JsonSerializerOptions?)null) ?? new List<AlertSelector>(),
                    JsonComparer<List<AlertSelector>>());

            // Store TranslatedStrings as JSONB
            b.Property(x => x.Header)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<TranslatedString>(v, (JsonSerializerOptions?)null) ?? new(),
                    JsonComparer<TranslatedString>());

            b.Property(x => x.Description)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<TranslatedString>(v, (JsonSerializerOptions?)null) ?? new(),
                    JsonComparer<TranslatedString>());

            // Store InfoUrls as JSONB array
            b.Property(x => x.InfoUrls)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>(),
                    JsonComparer<List<string>>());
        });
    }
}
