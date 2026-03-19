using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Enmarcha.Backend.Controllers.Backoffice;

[Route("backoffice/auth")]
public class LoginController : Controller
{
    [HttpGet("login")]
    [AllowAnonymous]
    public IActionResult Login(string returnUrl = "/backoffice")
    {
        return Challenge(new AuthenticationProperties { RedirectUri = returnUrl }, "Auth0");
    }

    [HttpPost("logout")]
    [ValidateAntiForgeryToken]
    [Authorize(AuthenticationSchemes = "Backoffice")]
    public IActionResult Logout()
    {
        return SignOut(
            new AuthenticationProperties { RedirectUri = "/backoffice" },
            "Backoffice",
            "Auth0");
    }
}

