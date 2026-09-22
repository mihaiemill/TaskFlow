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
        if (result is null)
            return Unauthorized("Email sau parolă incorectă.");
        return Ok(result);
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
        if (result is null)
        {
            Console.WriteLine("=== RESULT E NULL");
            return Unauthorized("Autentificare Google eșuată.");
        }

        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";
        var redirectUrl = $"{frontendUrl}/auth/google?token={result.Token}";
        Console.WriteLine($"=== REDIRECT CATRE: {redirectUrl[..60]}...");

        return Redirect(redirectUrl);
    }
}