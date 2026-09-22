using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using taskflow.Data;
using taskflow.DTOs.Auth;
using taskflow.Models;

namespace taskflow.Services;

public interface IAuthService
{
    Task<AuthResponseDto?> RegisterAsync(RegisterDto dto);
    Task<AuthResponseDto?> LoginAsync(LoginDto dto);
    string GetGoogleLoginUrl();
    Task<AuthResponseDto?> HandleGoogleCallbackAsync(string code);
}

public class AuthService(AppDbContext db, IConfiguration config) : IAuthService
{
    // redirectUri citit din config — funcționează atât pe localhost cât și pe IP/server
    private string RedirectUri =>
        $"{config["BackendUrl"] ?? "http://localhost:5179"}/api/auth/google/callback";

    public async Task<AuthResponseDto?> RegisterAsync(RegisterDto dto)
    {
        if (await db.Users.AnyAsync(u => u.Email == dto.Email))
            return null;

        var user = new User
        {
            Email = dto.Email,
            FullName = dto.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return new AuthResponseDto
        {
            Token = GenerateToken(user),
            FullName = user.FullName,
            Email = user.Email
        };
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return null;

        return new AuthResponseDto
        {
            Token = GenerateToken(user),
            FullName = user.FullName,
            Email = user.Email
        };
    }

    public string GetGoogleLoginUrl()
    {
        var clientId = config["Google:ClientId"];

        return "https://accounts.google.com/o/oauth2/v2/auth" +
               $"?client_id={clientId}" +
               $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}" +
               "&response_type=code" +
               "&scope=openid%20email%20profile" +
               "&access_type=offline";
    }

    public async Task<AuthResponseDto?> HandleGoogleCallbackAsync(string code)
    {
        var clientId = config["Google:ClientId"];
        var clientSecret = config["Google:ClientSecret"];

        using var http = new HttpClient();
        var tokenResponse = await http.PostAsync("https://oauth2.googleapis.com/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = clientId!,
                ["client_secret"] = clientSecret!,
                ["redirect_uri"] = RedirectUri,
                ["grant_type"] = "authorization_code"
            }));

        var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
        var tokenData = System.Text.Json.JsonDocument.Parse(tokenJson);
        var idToken = tokenData.RootElement.GetProperty("id_token").GetString();

        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken);

        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject);

        if (user == null)
        {
            user = await db.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);

            if (user == null)
            {
                user = new User
                {
                    Email = payload.Email,
                    FullName = payload.Name,
                    GoogleId = payload.Subject
                };
                db.Users.Add(user);
            }
            else
            {
                user.GoogleId = payload.Subject;
            }

            await db.SaveChangesAsync();
        }

        return new AuthResponseDto
        {
            Token = GenerateToken(user),
            FullName = user.FullName,
            Email = user.Email
        };
    }

    private string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("fullName", user.FullName)
        };
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}