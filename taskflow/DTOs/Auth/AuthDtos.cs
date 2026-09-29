using System.ComponentModel.DataAnnotations;

namespace taskflow.DTOs.Auth;

public class RegisterDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = null!;

    [Required, MinLength(6)]
    public string Password { get; set; } = null!;

    [Required]
    public string FullName { get; set; } = null!;

    public string? Avatar { get; set; }
}

public class UpdateAvatarDto
{
    public string? Avatar { get; set; }
}

public class LoginDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    public string Password { get; set; } = null!;
}

public class ChangePasswordDto
{
    public string? CurrentPassword { get; set; }

    [Required, MinLength(6)]
    public string NewPassword { get; set; } = null!;
}

public class AuthResponseDto
{
    public string Token { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string Email { get; set; } = null!;
}
