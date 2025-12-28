using Enmarcha.Backend.Services;

public abstract class AbstractRealTimeProcessor : IArrivalsProcessor
{
    public abstract Task ProcessAsync(ArrivalsContext context);

    protected static List<(double Lat, double Lon)> Decode(string encodedPoints)
    {
        if (string.IsNullOrEmpty(encodedPoints))
            return new List<(double, double)>();

        var poly = new List<(double, double)>();
        char[] polylineChars = encodedPoints.ToCharArray();
        int index = 0;

        int currentLat = 0;
        int currentLng = 0;
        int next5bits;
        int sum;
        int shifter;

        while (index < polylineChars.Length)
        {
            // calculate next latitude
            sum = 0;
            shifter = 0;
            do
            {
                next5bits = (int)polylineChars[index++] - 63;
                sum |= (next5bits & 31) << shifter;
                shifter += 5;
            } while (next5bits >= 32 && index < polylineChars.Length);

            if (index >= polylineChars.Length)
                break;

            currentLat += (sum & 1) == 1 ? ~(sum >> 1) : (sum >> 1);

            // calculate next longitude
            sum = 0;
            shifter = 0;
            do
            {
                next5bits = (int)polylineChars[index++] - 63;
                sum |= (next5bits & 31) << shifter;
                shifter += 5;
            } while (next5bits >= 32 && index < polylineChars.Length);

            currentLng += (sum & 1) == 1 ? ~(sum >> 1) : (sum >> 1);

            poly.Add((Convert.ToDouble(currentLat) / 100000.0, Convert.ToDouble(currentLng) / 100000.0));
        }

        return poly;
    }
}
