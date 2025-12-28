using Enmarcha.Backend.Types;

namespace Enmarcha.Backend.Services.Providers;

public interface ITransitProvider
{
    Task<List<ConsolidatedCirculation>> GetCirculationsAsync(string stopId, DateTime now);
}
