using Enmarcha.Backend.Dto;
using Enmarcha.Sources.OpenTripPlannerGql.Queries.V2;

namespace Enmarcha.Backend.Providers.RealTimeInformation;

public interface IRealTimeInformationProvider
{
    Task<(List<StopEstimate> arrivals, IEnumerable<DataSource>? dataSources)> ApplyRealtimeInformation(StopArrivalsResponse.StopItem stop, List<StopEstimate> arrivals);
}
