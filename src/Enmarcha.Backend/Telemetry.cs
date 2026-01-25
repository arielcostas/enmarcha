using System.Diagnostics;

namespace Enmarcha.Backend;

public static class Telemetry
{
    public static readonly ActivitySource Source = new("Enmarcha.Backend");
}
