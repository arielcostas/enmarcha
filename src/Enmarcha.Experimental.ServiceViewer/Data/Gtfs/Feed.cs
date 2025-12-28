using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Enmarcha.Experimental.ServiceViewer.Data.Gtfs;

[Table("feeds")]
public class Feed
{
    /// <summary>
    /// Auto-incrementing ID value for each feed, to identify it and its version
    /// </summary>
    [Key]
    public int Id { get; set; }

    [MaxLength(32)] public string ShortName { get; set; }
    [MaxLength(32)] public string LongName { get; set; }
    [MaxLength(255)] public string DownloadUrl { get; set; }
    [MaxLength(32)] public string Etag { get; set; }

    public DateTime InsertedAt { get; set; }
}
