using System.Text;
using Enmarcha.Experimental.ServiceViewer.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Experimental.ServiceViewer.Controllers;

[Controller]
[Route("")]
public class StylesheetController : Controller
{
    private readonly AppDbContext _db;
    public StylesheetController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("stylesheets/routecolours.css")]
    public IActionResult GetRouteColoursSheet()
    {
        var routeColours = _db.Routes
            .Select(r => new { Id = r.SafeId, r.Color, r.TextColor })
            .ToListAsync();

        StringBuilder sb = new();
        foreach (var route in routeColours.Result)
        {
            sb.Append($".route-{route.Id} {{");
            sb.Append($"--route-color: #{route.Color};");
            sb.Append($"--route-text: #{route.TextColor};");
            sb.Append($"--route-color-semi: #{route.Color}4d;");
            sb.Append($"--route-text-semi: #{route.TextColor}4d;");
            sb.Append('}');
        }
        sb.Append('}');

        return Content(sb.ToString(), "text/css", Encoding.UTF8);
    }
}
