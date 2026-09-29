using Microsoft.EntityFrameworkCore;
using taskflow.Data;

namespace taskflow.Services;

// Folosit la fiecare request autentificat (vezi JwtBearerEvents în Program.cs).
public static class AccountStatus
{
    // null = utilizatorul nu (mai) există; altfel dacă e activ
    public static Task<bool?> IsActiveAsync(AppDbContext db, Guid userId) =>
        db.Users
            .Where(u => u.Id == userId)
            .Select(u => (bool?)u.IsActive)
            .FirstOrDefaultAsync();
}
