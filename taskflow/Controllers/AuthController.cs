using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using taskflow.DTOs.Auth;
using taskflow.Services;

namespace taskflow.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, IConfiguration configuration) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        var result = await authService.RegisterAsync(dto);
        if (result is null)
            return Conflict("Email deja înregistrat.");
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var result = await authService.LoginAsync(dto);
        return result.Status switch
        {
            LoginStatus.Success  => Ok(result.Response),
            LoginStatus.Inactive => StatusCode(StatusCodes.Status403Forbidden,
                new { code = "account_inactive", error = "Contul este inactiv." }),
            _                    => Unauthorized("Email sau parolă incorectă."),
        };
    }

    [HttpGet("google")]
    public IActionResult GoogleLogin()
    {
        var url = authService.GetGoogleLoginUrl();
        return Ok(new { url });
    }

    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string code)
    {
        Console.WriteLine($"=== GOOGLE CALLBACK PRIMIT, code: {code?[..20]}...");

        var result = await authService.HandleGoogleCallbackAsync(code);
        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";

        if (result.Status == LoginStatus.Inactive)
            return Redirect($"{frontendUrl}/login?error=account_inactive");

        // refuzat (ex. emailul de admin) → înapoi la login cu mesaj, nu o pagină goală cu 401
        if (result.Response is null)
            return Redirect($"{frontendUrl}/login?error=google_failed");

        var redirectUrl = $"{frontendUrl}/auth/google?token={result.Response.Token}";
        Console.WriteLine($"=== REDIRECT CATRE: {redirectUrl[..60]}...");

        return Redirect(redirectUrl);
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value!);

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var me = await authService.GetMeAsync(CurrentUserId);
        if (me is null) return NotFound();
        return Ok(new { hasPassword = me.Value.HasPassword, avatar = me.Value.Avatar });
    }

    [Authorize]
    [HttpPatch("avatar")]
    public async Task<IActionResult> UpdateAvatar(UpdateAvatarDto dto)
    {
        var error = await authService.UpdateAvatarAsync(CurrentUserId, dto);
        if (error is not null)
            return BadRequest(new { error });
        return NoContent();
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto dto)
    {
        var error = await authService.ChangePasswordAsync(CurrentUserId, dto);
        if (error is not null)
            return BadRequest(new { error });
        return NoContent();
    }
}