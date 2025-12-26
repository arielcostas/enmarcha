using System.Text.Json.Serialization;

namespace Costasdev.Busurbano.Sources.OpenTripPlannerGql;

public class GraphClientRequest
{
    public string OperationName { get; set; } = "Query";
    public required string Query { get; set; }
}

public class GraphClientResponse<T> where T : AbstractGraphResponse
{
    [JsonPropertyName("data")]
    public T? Data { get; set; }

    [JsonPropertyName("errors")]
    public List<GraphClientError>? Errors { get; set; }

    public bool IsSuccess => Errors == null || Errors.Count == 0;
}

public interface IGraphRequest<T>
{
    static abstract string Query(T parameters);
}

public class AbstractGraphResponse
{
}

public class GraphClientError
{
    [JsonPropertyName("message")]
    public required string Message { get; set; }
}

