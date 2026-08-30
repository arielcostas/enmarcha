using System.Net.Http.Json;
using System.Text.Json;
using Enmarcha.Sources.OpenTripPlannerGql.Exceptions;
using Enmarcha.Sources.OpenTripPlannerGql.Queries;
using Enmarcha.Sources.OpenTripPlannerGql.Queries.V2;
using Microsoft.Extensions.Logging;

namespace Enmarcha.Sources.OpenTripPlannerGql;

public class OpenTripPlannerClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OpenTripPlannerClient> _logger;

    public OpenTripPlannerClient(
        HttpClient httpClient,
        ILogger<OpenTripPlannerClient> logger
    )
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<StopBasicsResponse> GetStopBasics(string stopId)
    {
        var requestContent =
            StopBasicsContent.Query(new StopBasicsContent.Args(stopId));

        return await DoGraphqlHttpRequest<StopBasicsResponse>(requestContent);
    }

    public async Task<AllStopsBasicsResponse> GetAllStopsBasics()
    {
        var requestContent = AllStopsBasicsContent.Query();

        return await DoGraphqlHttpRequest<AllStopsBasicsResponse>(requestContent);
    }

    public async Task<StopArrivalsResponse> GetStopArrivals(string stopId, bool includeGeometry)
    {
        var requestContent =
            StopArrivalsContent.Query(new StopArrivalsContent.Args(stopId, includeGeometry));

        return await DoGraphqlHttpRequest<StopArrivalsResponse>(requestContent);
    }

    /**
     * <exception cref="OpenTripPlannerConnectionException">If there's a problem connecting to the server</exception>
     */
    private async Task<TRes> DoGraphqlHttpRequest<TRes>(string query) where TRes : AbstractGraphResponse
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/otp/gtfs/v1");
        request.Content = JsonContent.Create(new GraphClientRequest
        {
            Query = query
        });

        HttpResponseMessage? response = null;
        GraphClientResponse<TRes>? responseBody;
        try
        {
            response = await _httpClient.SendAsync(request);
            responseBody = await response.Content.ReadFromJsonAsync<GraphClientResponse<TRes>>();
        }
        catch (HttpRequestException ex)
        {
            throw new OpenTripPlannerConnectionException("Unable to get proper HTTP response", ex);
        }
        catch (OperationCanceledException ex)
        {
            throw new OpenTripPlannerConnectionException("Server timeout", ex);
        }
        catch (JsonException ex)
        {
            _logger.LogError("Cannot deserialise JSON: {ResponseBody}", await response!.Content.ReadAsStringAsync());
            throw new OpenTripPlannerConnectionException("Response cannot be deserialised", ex);
        }

        switch (responseBody)
        {
            case null:
                throw new OpenTripPlannerConnectionException("Response could not be deserialised");
            case { IsSuccess: false }:
                throw new OpenTripPlannerErrorException(responseBody.Errors!.First().Message);
            default:
                return responseBody.Data!;
        }
    }
}
