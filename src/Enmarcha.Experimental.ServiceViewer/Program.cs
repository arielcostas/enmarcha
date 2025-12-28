using Enmarcha.Experimental.ServiceViewer;
using Enmarcha.Experimental.ServiceViewer.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.AddDbContext<AppDbContext>(db =>
{
    var connectionString = builder.Configuration.GetConnectionString("Database");
    if (string.IsNullOrEmpty(connectionString))
    {
        throw new InvalidOperationException("Connection string 'Database' is not configured.");
    }
    db.UseNpgsql(connectionString, npg =>
    {
        npg.UseNetTopologySuite();
    });
});

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseRouting();

app.UseStaticFiles();
app.MapStaticAssets();

app.MapControllers();

app.Run();
