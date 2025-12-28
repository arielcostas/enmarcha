using Enmarcha.Experimental.ServiceViewer.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Enmarcha.Experimental.ServiceViewer;

public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        IConfigurationRoot configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")}.json",
                optional: true)
            .AddUserSecrets(typeof(AppDbContext).Assembly, optional: true)
            .AddEnvironmentVariables()
            .Build();

        var builder = new DbContextOptionsBuilder<AppDbContext>();
        var connectionString = configuration.GetConnectionString("Database");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("Connection string 'Database' not found.");
        }

        var loggerFactory = LoggerFactory.Create(lb =>
        {
            lb
                .AddConsole()
                .SetMinimumLevel(LogLevel.Information);
        });
        builder.UseLoggerFactory(loggerFactory);

        builder.UseNpgsql(
            connectionString,
            options => options.UseNetTopologySuite()
        );

        return new AppDbContext(builder.Options);
    }
}
