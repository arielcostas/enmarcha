using Enmarcha.Backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Backend.Controllers.Backoffice;

[Route("backoffice")]
[Authorize(AuthenticationSchemes = "Backoffice")]
public class BackofficeController(AppDbContext db) : Controller
{
    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        ViewData["AlertCount"] = await db.ServiceAlerts.CountAsync();
        return View();
    }
}
