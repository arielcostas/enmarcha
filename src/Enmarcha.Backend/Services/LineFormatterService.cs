using Enmarcha.Backend.Types;

namespace Enmarcha.Backend.Services;

public class LineFormatterService
{
    public ConsolidatedCirculation Format(ConsolidatedCirculation circulation)
    {
        circulation.Route = circulation.Route.Replace("*", "");

        if (circulation.Route == "FORA DE SERVIZO.G.B.")
        {
            circulation.Route = "García Barbón, 7 (fora de servizo)";
            return circulation;
        }

        switch (circulation.Line)
        {
            case "A" when circulation.Route.StartsWith("\"1\""):
                circulation.Line = "A1";
                circulation.Route = circulation.Route.Replace("\"1\"", "");
                return circulation;
            case "6":
                circulation.Route = circulation.Route
                    .Replace("\"", "");
                return circulation;
            case "FUT":
                {
                    if (circulation.Route == "CASTELAO-CAMELIAS-G.BARBÓN.M.GARRIDO")
                    {
                        circulation.Line = "MAR";
                        circulation.Route = "MARCADOR ⚽: CASTELAO-CAMELIAS-G.BARBÓN.M.GARRIDO";
                    }

                    if (circulation.Route == "P. ESPAÑA-T.VIGO-S.BADÍA")
                    {
                        circulation.Line = "RIO";
                        circulation.Route = "RÍO ⚽: P. ESPAÑA-T.VIGO-S.BADÍA";
                    }

                    if (circulation.Route == "NAVIA-BOUZAS-URZAIZ-G. ESPINO")
                    {
                        circulation.Line = "GOL";
                        circulation.Route = "GOL ⚽: NAVIA-BOUZAS-URZAIZ-G. ESPINO";
                    }

                    return circulation;
                }
            default:
                return circulation;
        }
    }
}
