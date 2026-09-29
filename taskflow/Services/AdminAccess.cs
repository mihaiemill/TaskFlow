using Microsoft.EntityFrameworkCore;
using taskflow.Data;
using taskflow.Models;

namespace taskflow.Services;

// Adminul aplicației: are acces complet (nivel 3) la orice proiect și task,
// chiar dacă nu e owner sau asignat.
public static class AdminAccess
{
    public const string AdminEmail = "admin@admin.com";

    public static Task<bool> IsAdminAsync(AppDbContext db, Guid userId) =>
        db.Users.AnyAsync(u => u.Id == userId && u.Email == AdminEmail);

    // Comparație tolerantă (spații, majuscule), folosită ca să blocăm înregistrarea cu emailul de admin
    public static bool IsAdminEmail(string? email) =>
        string.Equals(email?.Trim(), AdminEmail, StringComparison.OrdinalIgnoreCase);

    public enum SeedResult { AlreadyExists, Created, MissingPassword }

    // Rulat la pornire: pe o bază nouă creează contul de admin cu parola din configurare
    // (Admin:InitialPassword). Dacă adminul există deja, nu schimbă nimic — nici parola.
    public static async Task<SeedResult> EnsureAdminAsync(AppDbContext db, string? initialPassword)
    {
        if (await db.Users.AnyAsync(u => u.Email == AdminEmail))
            return SeedResult.AlreadyExists;

        if (string.IsNullOrWhiteSpace(initialPassword) || initialPassword.Length < 6)
            return SeedResult.MissingPassword;

        db.Users.Add(new User
        {
            Email = AdminEmail,
            FullName = "Admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(initialPassword),
            IsActive = true,
        });
        await db.SaveChangesAsync();
        return SeedResult.Created;
    }
}
