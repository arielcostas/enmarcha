using System.Text.Json.Serialization;
using Enmarcha.Backend;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Services.Geocoding;
using Enmarcha.Backend.Services.Processors;
using Enmarcha.Backend.Services.Providers;
using Microsoft.AspNetCore.WebUtilities;
using OpenTelemetry.Logs;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AppConfiguration>(builder.Configuration.GetSection("App"));

var appConfig = builder.Configuration.GetSection("App").Get<AppConfiguration>();
var otelConfig = appConfig?.OpenTelemetry;

builder.Logging.AddOpenTelemetry(options =>
{
    options.SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("Enmarcha.Backend"));
    options.IncludeFormattedMessage = true;
    options.IncludeScopes = true;

    if (otelConfig?.Endpoint != null)
    {
        options.AddOtlpExporter(exporterOptions =>
        {
            exporterOptions.Endpoint = new Uri(otelConfig.Endpoint);
            exporterOptions.Headers = otelConfig.Headers;
        });
    }

#if DEBUG
    options.AddOtlpExporter(exporterOptions =>
    {
        exporterOptions.Endpoint = new Uri("http://localhost:17011");
    });
#endif
});

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("Enmarcha.Backend"))
            .AddSource(Telemetry.Source.Name)
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation(options =>
            {
                options.EnrichWithHttpRequestMessage = (activity, req) =>
                {
                    var host = req.RequestUri?.Host;
                    if (host == null) return;

                    // Set default peer service to host
                    activity.SetTag("peer.service", host);
                    activity.SetTag("server.address", host);

                    if (host == "api.geoapify.com")
                    {
                        activity.SetTag("peer.service", "Geoapify");
                        var query = QueryHelpers.ParseQuery(req.RequestUri!.Query);
                        if (query.ContainsKey("apiKey"))
                        {
                            var uriBuilder = new UriBuilder(req.RequestUri);
                            var newQuery = query.ToDictionary(x => x.Key, x => x.Value.ToString());
                            newQuery["apiKey"] = "REDACTED";
                            uriBuilder.Query = string.Join("&", newQuery.Select(x => $"{x.Key}={x.Value}"));
                            activity.SetTag("http.url", uriBuilder.ToString());
                        }
                    }
                    else if (host.Contains("tussa.org"))
                    {
                        activity.SetTag("peer.service", "TUSSA");
                    }
                    else if (host.Contains("itranvias.com"))
                    {
                        activity.SetTag("peer.service", "Tranvías Coruña");
                    }
                    else if (host.Contains("vigo.org"))
                    {
                        activity.SetTag("peer.service", "Vitrasa");
                    }
                    else if (appConfig?.OpenTripPlannerBaseUrl != null && req.RequestUri!.ToString().StartsWith(appConfig.OpenTripPlannerBaseUrl))
                    {
                        activity.SetTag("peer.service", "OpenTripPlanner");
                    }
                };
            })
            .SetSampler(new TraceIdRatioBasedSampler(0.75));

        if (otelConfig?.Endpoint != null)
        {
            tracing.AddOtlpExporter(exporterOptions =>
            {
                exporterOptions.Endpoint = new Uri(otelConfig.Endpoint);
                exporterOptions.Headers = otelConfig.Headers;
            });
        }

#if DEBUG
        tracing.AddOtlpExporter(exporterOptions =>
        {
            exporterOptions.Endpoint = new Uri("http://localhost:17011");
        });
#endif
    });

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
builder.Services.AddScoped<IArrivalsProcessor, SantiagoRealTimeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, VigoUsageProcessor>();

builder.Services.AddScoped<IArrivalsProcessor, FilterAndSortProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, NextStopsProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, MarqueeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, ShapeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, FeedConfigProcessor>();
builder.Services.AddScoped<ArrivalsPipeline>();

// builder.Services.AddKeyedScoped<IGeocodingService, NominatimGeocodingService>("Nominatim");
builder.Services.AddHttpClient<IGeocodingService, GeoapifyGeocodingService>();
builder.Services.AddHttpClient<OtpService>();
builder.Services.AddHttpClient<Enmarcha.Sources.TranviasCoruna.CorunaRealtimeEstimatesProvider>();
builder.Services.AddHttpClient<Enmarcha.Sources.Tussa.SantiagoRealtimeEstimatesProvider>();
builder.Services.AddHttpClient<Costasdev.VigoTransitApi.VigoTransitApiClient>();

var app = builder.Build();

app.Use(async (context, next) =>
{
    if (context.Request.Headers.TryGetValue("X-Session-Id", out var sessionId))
    {
        System.Diagnostics.Activity.Current?.SetTag("session.id", sessionId.ToString());
    }
    await next();
});

app.MapControllers();

app.Run();
