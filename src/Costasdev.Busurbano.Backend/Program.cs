using System.Text.Json.Serialization;
using Costasdev.Busurbano.Backend.Configuration;
using Costasdev.Busurbano.Backend.Services;
using Costasdev.Busurbano.Backend.Services.Providers;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AppConfiguration>(builder.Configuration.GetSection("App"));

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ShapeTraversalService>();

builder.Services.AddHttpClient<OtpService>();
builder.Services.AddScoped<VitrasaTransitProvider>();
builder.Services.AddScoped<RenfeTransitProvider>();

var app = builder.Build();

app.MapControllers();

app.Run();
