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

public enum LoginStatus { Success, InvalidCredentials, Inactive }

// Response e setat doar când Status == Success
public record LoginResult(LoginStatus Status, AuthResponseDto? Response = null);

public interface IAuthService
{
    Task<AuthResponseDto?> RegisterAsync(RegisterDto dto);
    Task<LoginResult> LoginAsync(LoginDto dto);
    string GetGoogleLoginUrl();
    Task<LoginResult> HandleGoogleCallbackAsync(string code);
    Task<(bool HasPassword, string? Avatar)?> GetMeAsync(Guid userId);
    Task<string?> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
    Task<string?> UpdateAvatarAsync(Guid userId, UpdateAvatarDto dto);
}

public class AuthService(AppDbContext db, IConfiguration config) : IAuthService
{
    // redirectUri citit din config — funcționează atât pe localhost cât și pe IP/server
    private string RedirectUri =>
        $"{config["BackendUrl"] ?? "http://localhost:5179"}/api/auth/google/callback";

    public async Task<AuthResponseDto?> RegisterAsync(RegisterDto dto)
    {
        // Contul de admin nu se poate crea prin înregistrare publică (altfel, pe o bază nouă,
        // primul venit ar deveni admin) — e creat la pornire de AdminAccess.EnsureAdminAsync.
        if (AdminAccess.IsAdminEmail(dto.Email))
            return null;

        if (await db.Users.AnyAsync(u => u.Email == dto.Email))
            return null;

        var user = new User
        {
            Email = dto.Email,
            FullName = dto.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Avatar = AvatarCatalog.IsValid(dto.Avatar) ? AvatarCatalog.Normalize(dto.Avatar) : null
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

    public async Task<LoginResult> LoginAsync(LoginDto dto)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        // PasswordHash e null pentru conturile create doar cu Google — nu au parolă cu care să se logheze
        if (user?.PasswordHash is null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return new LoginResult(LoginStatus.InvalidCredentials);

        // verificat abia după parolă, ca starea contului să nu fie dezvăluită fără credențiale corecte
        if (!user.IsActive)
            return new LoginResult(LoginStatus.Inactive);

        return new LoginResult(LoginStatus.Success, new AuthResponseDto
        {
            Token = GenerateToken(user),
            FullName = user.FullName,
            Email = user.Email
        });
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

    public async Task<LoginResult> HandleGoogleCallbackAsync(string code)
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

        return await SignInWithGoogleAsync(payload.Subject, payload.Email, payload.Name);
    }

    // Partea de după validarea token-ului Google: găsește / leagă / creează contul.
    // Separată de HandleGoogleCallbackAsync ca să poată fi testată fără apeluri către Google.
    public async Task<LoginResult> SignInWithGoogleAsync(string googleSubject, string email, string name)
    {
        // Adminul se autentifică doar cu email + parolă: nu legăm și nu creăm contul de admin
        // printr-un cont Google cu aceeași adresă.
        if (AdminAccess.IsAdminEmail(email))
            return new LoginResult(LoginStatus.InvalidCredentials);

        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleId == googleSubject);

        // un GoogleId legat de admin înainte de această regulă nu mai deschide contul
        if (user is not null && AdminAccess.IsAdminEmail(user.Email))
            return new LoginResult(LoginStatus.InvalidCredentials);

        if (user == null)
        {
            user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
            {
                user = new User
                {
                    Email = email,
                    FullName = name,
                    GoogleId = googleSubject
                };
                db.Users.Add(user);
            }
            else
            {
                user.GoogleId = googleSubject;
            }

            await db.SaveChangesAsync();
        }

        if (!user.IsActive)
            return new LoginResult(LoginStatus.Inactive);

        return new LoginResult(LoginStatus.Success, new AuthResponseDto
        {
            Token = GenerateToken(user),
            FullName = user.FullName,
            Email = user.Email
        });
    }

    public async Task<(bool HasPassword, string? Avatar)?> GetMeAsync(Guid userId)
    {
        var user = await db.Users.FindAsync(userId);
        return user is null ? null : (user.PasswordHash != null, user.Avatar);
    }

    public async Task<string?> UpdateAvatarAsync(Guid userId, UpdateAvatarDto dto)
    {
        if (!AvatarCatalog.IsValid(dto.Avatar))
            return "Avatar necunoscut.";

        var user = await db.Users.FindAsync(userId);
        if (user is null)
            return "Utilizatorul nu există.";

        user.Avatar = AvatarCatalog.Normalize(dto.Avatar);
        await db.SaveChangesAsync();
        return null;
    }

    // Returnează null la succes, altfel mesajul de eroare.
    // Conturile doar-Google nu au parolă curentă, deci își pot seta una fără verificare.
    public async Task<string?> ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null)
            return "Utilizatorul nu există.";

        if (user.PasswordHash != null &&
            (string.IsNullOrEmpty(dto.CurrentPassword) || !BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash)))
            return "Parola curentă este incorectă.";

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await db.SaveChangesAsync();
        return null;
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