using System.Text.Json.Serialization;
using Enmarcha.Backend;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Enmarcha.Backend.Configuration;
using Enmarcha.Backend.Data;
using Enmarcha.Backend.Services;
using Enmarcha.Backend.Services.Geocoding;
using Enmarcha.Backend.Services.Processors;
using Enmarcha.Backend.Services.Providers;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
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
    options.AddOtlpExporter(exporterOptions => { exporterOptions.Endpoint = new Uri("http://localhost:17011"); });
#endif
});

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("Enmarcha.Backend"))
            .AddSource(Telemetry.Source.Name)
            .AddAspNetCoreInstrumentation(options =>
            {
                options.EnrichWithHttpRequest = (activity, request) =>
                {
                    var ip = request.HttpContext.Connection.RemoteIpAddress;
                    if (ip == null) return;
                    string anonymised;
                    if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                    {
                        var bytes = ip.GetAddressBytes();
                        bytes[3] = 0;
                        anonymised = new System.Net.IPAddress(bytes).ToString();
                    }
                    else
                    {
                        var bytes = ip.GetAddressBytes();
                        for (var i = 6; i < 16; i++) bytes[i] = 0;
                        anonymised = new System.Net.IPAddress(bytes).ToString();
                    }

                    activity.SetTag("client.address", anonymised);
                };
            })
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
                    else if (appConfig?.OpenTripPlannerBaseUrl != null &&
                             req.RequestUri!.ToString().StartsWith(appConfig.OpenTripPlannerBaseUrl))
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
        tracing.AddOtlpExporter(exporterOptions => { exporterOptions.Endpoint = new Uri("http://localhost:17011"); });
#endif
    });

builder.Services
    .AddControllersWithViews()
    .AddJsonOptions(options => { options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()); });

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(
            builder.Configuration.GetConnectionString("Database"),
            o => o.UseNetTopologySuite()
        )
        .UseCamelCaseNamingConvention();
});

var auth0Domain = builder.Configuration["Auth0:Domain"] ?? "";
var auth0ClientId = builder.Configuration["Auth0:ClientId"] ?? "";

builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = "Backoffice";
        options.DefaultChallengeScheme = "Auth0";
    })
    .AddCookie("Backoffice", options => {
        options.LoginPath = "/backoffice/auth/login";
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    })
    .AddOpenIdConnect("Auth0", options =>
    {
        options.Authority = $"https://{auth0Domain}/";
        options.ClientId = auth0ClientId;
        options.ClientSecret = builder.Configuration["Auth0:ClientSecret"];
        options.ResponseType = "code";
        options.CallbackPath = "/backoffice/auth/callback";
        options.SignInScheme = "Backoffice";

        options.CorrelationCookie.Path = "/";
        options.NonceCookie.Path = "/";

        options.Scope.Clear();
        options.Scope.Add("openid");
        options.Scope.Add("profile");
        options.Scope.Add("email");

        options.SaveTokens = true;
        options.Events = new OpenIdConnectEvents
        {
            OnRedirectToIdentityProviderForSignOut = context =>
            {
                var logoutUri = $"https://{auth0Domain}/v2/logout?client_id={Uri.EscapeDataString(auth0ClientId)}";
                var returnTo = context.Properties.RedirectUri;
                if (!string.IsNullOrEmpty(returnTo))
                {
                    var req = context.Request;
                    if (!returnTo.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                        returnTo = $"{req.Scheme}://{req.Host}{req.PathBase}{returnTo}";
                    logoutUri += $"&returnTo={Uri.EscapeDataString(returnTo)}";
                }

                context.Response.Redirect(logoutUri);
                context.HandleResponse();
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddSingleton<XuntaFareProvider>();

builder.Services.AddSingleton<ShapeTraversalService>();
builder.Services.AddSingleton<FeedService>();
builder.Services.AddSingleton<FareService>();

builder.Services.AddScoped<IPushNotificationService, PushNotificationService>();
builder.Services.AddHostedService<AlertPhaseNotificationHostedService>();

builder.Services.AddScoped<IArrivalsProcessor, VitrasaRealTimeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, CorunaRealTimeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, TussaRealTimeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, CtagShuttleRealTimeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, VitrasaUsageProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, RenfeRealTimeProcessor>();

builder.Services.AddScoped<IArrivalsProcessor, FilterAndSortProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, NextStopsProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, ShapeProcessor>();
builder.Services.AddScoped<IArrivalsProcessor, FeedConfigProcessor>();
builder.Services.AddScoped<ArrivalsPipeline>();

// builder.Services.AddKeyedScoped<IGeocodingService, NominatimGeocodingService>("Nominatim");
builder.Services.AddHttpClient<IGeocodingService, GeoapifyGeocodingService>();
builder.Services.AddHttpClient<OtpService>();
builder.Services.AddHttpClient<BackofficeSelectorService>();
builder.Services.AddHttpClient<Enmarcha.Sources.TranviasCoruna.CorunaRealtimeEstimatesProvider>();
builder.Services.AddHttpClient<Enmarcha.Sources.Tussa.SantiagoRealtimeEstimatesProvider>();
builder.Services.AddHttpClient<Enmarcha.Sources.CtagShuttle.CtagShuttleRealtimeEstimatesProvider>();
builder.Services.AddHttpClient<Enmarcha.Sources.GtfsRealtime.GtfsRealtimeEstimatesProvider>();
builder.Services.AddHttpClient<Costasdev.VigoTransitApi.VigoTransitApiClient>();

var app = builder.Build();

var forwardedHeaderOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost
};

// Crucial: Clear the networks/proxies list if you are in a container or specific Linux setup
forwardedHeaderOptions.KnownIPNetworks.Clear();
forwardedHeaderOptions.KnownProxies.Clear();

app.UseForwardedHeaders(forwardedHeaderOptions);

app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

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
