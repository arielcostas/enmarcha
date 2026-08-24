namespace Enmarcha.Sources.OpenTripPlannerGql.Exceptions;

public class OpenTripPlannerConnectionException : Exception
{
    public OpenTripPlannerConnectionException()
    {
    }

    public OpenTripPlannerConnectionException(string? message) : base(message)
    {
    }

    public OpenTripPlannerConnectionException(string? message, Exception? innerException) : base(message, innerException)
    {
    }
}
