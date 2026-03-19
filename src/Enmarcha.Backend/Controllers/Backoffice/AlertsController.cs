using Enmarcha.Backend.Data;
using Enmarcha.Backend.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Enmarcha.Backend.Controllers.Backoffice;

[Route("backoffice/alerts")]
[Authorize(AuthenticationSchemes = "Backoffice")]
public class AlertsController(AppDbContext db) : Controller
{
    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var alerts = await db.ServiceAlerts
            .OrderByDescending(a => a.InsertedDate)
            .ToListAsync();
        return View(alerts);
    }

    [HttpGet("create")]
    public IActionResult Create() => View("Edit", new AlertFormViewModel());

    [HttpPost("create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreatePost(AlertFormViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View("Edit", model);
        }

        db.ServiceAlerts.Add(model.ToServiceAlert());
        await db.SaveChangesAsync();
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("{id}/edit")]
    public async Task<IActionResult> Edit(string id)
    {
        var alert = await db.ServiceAlerts.FindAsync(id);
        if (alert is null) return NotFound();
        return View(AlertFormViewModel.FromServiceAlert(alert));
    }

    [HttpPost("{id}/edit")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditPost(string id, AlertFormViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View("Edit", model);
        }

        var alert = await db.ServiceAlerts.FindAsync(id);
        if (alert is null) return NotFound();

        model.ApplyTo(alert);
        await db.SaveChangesAsync();
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("{id}/delete")]
    public async Task<IActionResult> Delete(string id)
    {
        var alert = await db.ServiceAlerts.FindAsync(id);
        if (alert is null) return NotFound();
        return View(alert);
    }

    [HttpPost("{id}/delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteConfirm(string id)
    {
        var alert = await db.ServiceAlerts.FindAsync(id);
        if (alert is null) return NotFound();

        db.ServiceAlerts.Remove(alert);
        await db.SaveChangesAsync();
        return RedirectToAction(nameof(Index));
    }
}
