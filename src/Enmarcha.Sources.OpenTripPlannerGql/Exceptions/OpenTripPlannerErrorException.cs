namespace Enmarcha.Sources.OpenTripPlannerGql.Exceptions;

public class OpenTripPlannerErrorException : Exception
{
    public OpenTripPlannerErrorException()
    {
    }

    public OpenTripPlannerErrorException(string? message) : base(message)
    {
    }

    public OpenTripPlannerErrorException(string? message, Exception? innerException) : base(message, innerException)
    {
    }
}
