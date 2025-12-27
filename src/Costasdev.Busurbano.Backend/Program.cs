using System.Text.Json.Serialization;
using Costasdev.Busurbano.Backend.Configuration;
using Costasdev.Busurbano.Backend.Services;
using Costasdev.Busurbano.Backend.Services.Processors;
using Costasdev.Busurbano.Backend.Services.Providers;
using Costasdev.Busurbano.Sources.TranviasCoruna;

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

builder.Services.AddSingleton<XuntaFareProvider>();

builder.Services.AddSingleton<ShapeTraversalService>();
builder.Services.AddSingleton<FeedService>();
builder.Services.AddSingleton<FareService>();
builder.Services.AddSingleton<LineFormatterService>();

builder.Services.AddScoped<IArrivalsProcessor, VitrasaRealTimeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, CorunaRealTimeProcessor>();

builder.Services.AddScoped<IArrivalsProcessor, FilterAndSortProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, NextStopsProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, MarqueeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, ShapeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, FeedConfigProcessor>();
builder.Services.AddScoped<ArrivalsPipeline>();

builder.Services.AddHttpClient<OtpService>();
builder.Services.AddScoped<VitrasaTransitProvider>();
builder.Services.AddScoped<RenfeTransitProvider>();

var app = builder.Build();

app.MapControllers();

app.Run();
