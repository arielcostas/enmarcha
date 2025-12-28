using System.Globalization;
using System.Text.Json.Serialization;

namespace Costasdev.Busurbano.Sources.OpenTripPlannerGql.Queries;

#pragma warning disable CS8618

public class PlanConnectionContent : IGraphRequest<PlanConnectionContent.Args>
{
    public record Args(
        double StartLatitude,
        double StartLongitude,
        double EndLatitude,
        double EndLongitude,
        DateTimeOffset ReferenceTime,
        bool ReferenceIsArrival = false
    );

    public static string Query(Args args)
    {
        var madridTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

        // Treat incoming DateTime as Madrid local wall-clock time
        var localMadridTime =
            DateTime.SpecifyKind(args.ReferenceTime.UtcDateTime, DateTimeKind.Unspecified);

        var offset = madridTz.GetUtcOffset(localMadridTime);

        var dateTimeToUse = new DateTimeOffset(args.ReferenceTime.DateTime + offset, offset);

        var dateTimeParameter = args.ReferenceIsArrival ? $"latestArrival:\"{dateTimeToUse:O}\"" : $"earliestDeparture:\"{dateTimeToUse:O}\"";

        return string.Create(CultureInfo.InvariantCulture,
            $$"""
              query Query {
                planConnection(
                  first: 4
                  origin: {
                    location:{
                      coordinate:{
                        latitude:{{args.StartLatitude}}
                        longitude:{{args.StartLongitude}}
                      }
                    }
                  }
                  destination:{
                    location:{
                      coordinate:{
                        latitude:{{args.EndLatitude}}
                        longitude:{{args.EndLongitude}}
                      }
                    }
                  }
                  dateTime:{
                    {{dateTimeParameter}}
                  }
                  searchWindow:"PT5H"
                ) {
                  edges {
                    node {
                      duration
                      start
                      end
                      walkTime
                      walkDistance
                      waitingTime
                      legs {
                        start  {
                          scheduledTime
                        }
                        end {
                          scheduledTime
                        }
                        mode
                        route {
                          gtfsId
                         	shortName
                          longName
                          agency {
                            name
                          }
                          color
                          textColor
                        }
                        from {
                          name
                          lat
                          lon
                          stop {
                            gtfsId
                            code
                            name
                            lat
                            lon
                            zoneId
                          }
                        }
                        to {
                          name
                          lat
                          lon
                          stop {
                            gtfsId
                            code
                            name
                            lat
                            lon
                            zoneId
                          }
                        }
                        stopCalls {
                          stopLocation {
                            ... on Stop {
                              gtfsId
                              code
                              name
                              lat
                              lon
                            }
                          }
                        }
                        legGeometry {
                          points
                        }
                        steps {
                          distance
                          relativeDirection
                          streetName
                          absoluteDirection
                          lat
                          lon
                        }
                        headsign
                        distance
                      }
                    }
                  }
                }
              }
              """);
    }
}

public class PlanConnectionResponse : AbstractGraphResponse
{
    public PlanConnectionItem PlanConnection { get; set; }

    public class PlanConnectionItem
    {
        [JsonPropertyName("edges")]
        public Edge[] Edges { get; set; }
    }

    public class Edge
    {
        [JsonPropertyName("node")]
        public Node Node { get; set; }
    }

    public class Node
    {
        [JsonPropertyName("duration")] public int DurationSeconds { get; set; }
        [JsonPropertyName("start")] public string Start8601 { get; set; }
        [JsonPropertyName("end")] public string End8601 { get; set; }
        [JsonPropertyName("walkTime")] public int WalkSeconds { get; set; }
        [JsonPropertyName("walkDistance")] public double WalkDistance { get; set; }
        [JsonPropertyName("waitingTime")] public int WaitingSeconds { get; set; }
        [JsonPropertyName("legs")] public Leg[] Legs { get; set; }
    }

    public class Leg
    {
        [JsonPropertyName("start")] public ScheduledTimeContainer Start { get; set; }
        [JsonPropertyName("end")] public ScheduledTimeContainer End { get; set; }
        [JsonPropertyName("mode")] public string Mode { get; set; } // TODO: Make enum, maybe
        [JsonPropertyName("route")] public TransitRoute? Route { get; set; }
        [JsonPropertyName("from")] public LegPosition From { get; set; }
        [JsonPropertyName("to")] public LegPosition To { get; set; }
        [JsonPropertyName("stopCalls")] public StopCall[] StopCalls { get; set; }
        [JsonPropertyName("legGeometry")] public LegGeometry LegGeometry { get; set; }
        [JsonPropertyName("steps")] public Step[] Steps { get; set; }
        [JsonPropertyName("headsign")] public string? Headsign { get; set; }
        [JsonPropertyName("distance")] public double Distance { get; set; }
    }

    public class TransitRoute
    {
        [JsonPropertyName("gtfsId")] public string GtfsId { get; set; }
        [JsonPropertyName("shortName")] public string ShortName { get; set; }
        [JsonPropertyName("longName")] public string LongName { get; set; }
        [JsonPropertyName("agency")] public AgencyNameContainer Agency { get; set; }
        [JsonPropertyName("color")] public string Color { get; set; }
        [JsonPropertyName("textColor")] public string TextColor { get; set; }
    }

    public class LegPosition
    {
        [JsonPropertyName("name")] public string Name { get; set; }
        [JsonPropertyName("lat")] public double Latitude { get; set; }
        [JsonPropertyName("lon")] public double Longitude { get; set; }
        [JsonPropertyName("stop")] public StopLocation Stop { get; set; }
    }

    public class ScheduledTimeContainer
    {
        [JsonPropertyName("scheduledTime")]
        public string ScheduledTime8601 { get; set; }
    }

    public class AgencyNameContainer
    {
        [JsonPropertyName("name")] public string Name { get; set; }
    }

    public class StopCall
    {
        [JsonPropertyName("stopLocation")]
        public StopLocation StopLocation { get; set; }
    }

    public class StopLocation
    {
        [JsonPropertyName("gtfsId")] public string GtfsId { get; set; }
        [JsonPropertyName("code")] public string Code { get; set; }
        [JsonPropertyName("name")] public string Name { get; set; }
        [JsonPropertyName("lat")] public double Latitude { get; set; }
        [JsonPropertyName("lon")] public double Longitude { get; set; }
        [JsonPropertyName("zoneId")] public string? ZoneId { get; set; }
    }

    public class Step
    {
        [JsonPropertyName("distance")] public double Distance { get; set; }
        [JsonPropertyName("relativeDirection")] public string RelativeDirection { get; set; }
        [JsonPropertyName("streetName")] public string StreetName { get; set; } // TODO: "sidewalk", "path" or actual street name
        [JsonPropertyName("absoluteDirection")] public string AbsoluteDirection { get; set; }
        [JsonPropertyName("lat")] public double Latitude { get; set; }
        [JsonPropertyName("lon")] public double Longitude { get; set; }
    }

    public class LegGeometry
    {
        [JsonPropertyName("points")] public string? Points { get; set; }
    }
}
