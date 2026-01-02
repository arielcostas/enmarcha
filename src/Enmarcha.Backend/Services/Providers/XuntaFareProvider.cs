using System.Collections.Frozen;
using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration.Attributes;

namespace Enmarcha.Backend.Services.Providers;

public class PriceRecord
{
    [Name("conc_inicio")] public string Origin { get; set; }
    [Name("conc_fin")] public string Destination { get; set; }
    [Name("bonificacion")] public string? MetroArea { get; set; }
    [Name("efectivo")] public decimal PriceCash { get; set; }
    [Name("tpg")] public decimal PriceCard { get; set; }
}

public class XuntaFareProvider
{
    private readonly FrozenDictionary<(string, string), PriceRecord> _priceMatrix;

    public XuntaFareProvider(IWebHostEnvironment env)
    {
        var filePath = Path.Combine(env.ContentRootPath, "Data", "xunta_fares.csv");

        using var reader = new StreamReader(filePath);
        using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);

        // We do GroupBy first to prevent duplicates from throwing an exception
        _priceMatrix = csv.GetRecords<PriceRecord>()
            .GroupBy(record => (record.Origin, record.Destination))
            .ToFrozenDictionary(
                group => group.Key,
                group => group.First()
            );
    }

    public PriceRecord? GetPrice(string origin, string destination)
    {
        var originMunicipality = origin[..5];
        var destinationMunicipality = destination[..5];

        var valueOrDefault = _priceMatrix.GetValueOrDefault((originMunicipality, destinationMunicipality));

        /* This happens in cases where traffic is forbidden (like inside municipalities with urban transit */
        if (valueOrDefault?.PriceCash == 0.0M)
        {
            valueOrDefault.PriceCash = 100;
        }

        if (valueOrDefault?.PriceCard == 0.0M)
        {
            valueOrDefault.PriceCard = 100;
        }

        return valueOrDefault;
    }
}
