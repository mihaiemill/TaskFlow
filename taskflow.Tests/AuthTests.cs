using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using taskflow.Controllers;
using taskflow.DTOs.Auth;
using taskflow.Services;

namespace taskflow.Tests;

public class AuthServiceTests
{
    private static (AuthService service, Seed seed, Data.AppDbContext db) Setup()
    {
        var db = TestDb.Create();
        return (new AuthService(db, TestConfig.Create()), new Seed(db), db);
    }

    [Fact]
    public async Task Login_CorrectCredentials_ReturnsTokenWithUserClaims()
    {
        var (service, seed, _) = Setup();
        var user = seed.User("Ana", "ana@test.ro");

        var result = await service.LoginAsync(new LoginDto { Email = "ana@test.ro", Password = Seed.DefaultPassword });

        Assert.Equal(LoginStatus.Success, result.Status);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Response!.Token);
        Assert.Equal(user.Id.ToString(), jwt.Subject);
        Assert.Contains(jwt.Claims, c => c.Type == "email" && c.Value == "ana@test.ro");
    }

    [Fact]
    public async Task Login_WrongPassword_IsInvalidCredentials()
    {
        var (service, seed, _) = Setup();
        seed.User(email: "ana@test.ro");

        var result = await service.LoginAsync(new LoginDto { Email = "ana@test.ro", Password = "gresita" });

        Assert.Equal(LoginStatus.InvalidCredentials, result.Status);
        Assert.Null(result.Response);
    }

    [Fact]
    public async Task Login_UnknownEmail_IsInvalidCredentials()
    {
        var (service, _, _) = Setup();

        var result = await service.LoginAsync(new LoginDto { Email = "nimeni@test.ro", Password = "orice" });

        Assert.Equal(LoginStatus.InvalidCredentials, result.Status);
    }

    [Fact]
    public async Task Login_InactiveAccount_CorrectPassword_IsInactive()
    {
        var (service, seed, _) = Setup();
        seed.User(email: "ana@test.ro", active: false);

        var result = await service.LoginAsync(new LoginDto { Email = "ana@test.ro", Password = Seed.DefaultPassword });

        Assert.Equal(LoginStatus.Inactive, result.Status);
        Assert.Null(result.Response);
    }

    [Fact]
    public async Task Login_InactiveAccount_WrongPassword_DoesNotRevealStatus()
    {
        var (service, seed, _) = Setup();
        seed.User(email: "ana@test.ro", active: false);

        var result = await service.LoginAsync(new LoginDto { Email = "ana@test.ro", Password = "gresita" });

        Assert.Equal(LoginStatus.InvalidCredentials, result.Status);
    }

    // Regresie pentru bug-ul #8: contul creat doar cu Google nu are parolă — BCrypt primea null și arunca (500).
    [Fact]
    public async Task Login_GoogleOnlyAccount_WithPassword_IsInvalidCredentials()
    {
        var (service, seed, _) = Setup();
        seed.User(email: "google@test.ro", password: null, googleId: "google-sub-1");

        var result = await service.LoginAsync(new LoginDto { Email = "google@test.ro", Password = "orice" });

        Assert.Equal(LoginStatus.InvalidCredentials, result.Status);
    }

    [Fact]
    public async Task Register_NewEmail_CreatesUserWithHashedPassword()
    {
        var (service, _, db) = Setup();

        var result = await service.RegisterAsync(new RegisterDto { Email = "nou@test.ro", Password = "parola123", FullName = "Nou" });

        Assert.NotNull(result);
        var user = db.Users.Single(u => u.Email == "nou@test.ro");
        Assert.NotEqual("parola123", user.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify("parola123", user.PasswordHash));
    }

    [Fact]
    public async Task Register_ExistingEmail_ReturnsNull()
    {
        var (service, seed, _) = Setup();
        seed.User(email: "ana@test.ro");

        var result = await service.RegisterAsync(new RegisterDto { Email = "ana@test.ro", Password = "parola123", FullName = "Alta Ana" });

        Assert.Null(result);
    }

    // Regresie pentru bug-ul #9 (critic): pe o bază nouă, oricine se putea înregistra cu emailul de admin.
    [Fact]
    public async Task Register_WithAdminEmail_IsRefused()
    {
        var (service, _, _) = Setup();

        var result = await service.RegisterAsync(new RegisterDto { Email = AdminAccess.AdminEmail, Password = "parola123", FullName = "Intrus" });

        Assert.Null(result);
    }

    [Theory]
    [InlineData("ADMIN@admin.com")]
    [InlineData("  admin@admin.com  ")]
    public async Task Register_WithAdminEmailVariants_IsRefused(string email)
    {
        var (service, _, db) = Setup();

        Assert.Null(await service.RegisterAsync(new RegisterDto { Email = email, Password = "parola123", FullName = "Intrus" }));
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task EnsureAdmin_FreshDatabase_CreatesAdminWithGivenPassword()
    {
        var (service, _, db) = Setup();

        Assert.Equal(AdminAccess.SeedResult.Created, await AdminAccess.EnsureAdminAsync(db, "parolaAdmin"));

        var login = await service.LoginAsync(new LoginDto { Email = AdminAccess.AdminEmail, Password = "parolaAdmin" });
        Assert.Equal(LoginStatus.Success, login.Status);
    }

    [Fact]
    public async Task EnsureAdmin_AdminExists_KeepsItsPassword()
    {
        var (service, seed, db) = Setup();
        seed.Admin();

        Assert.Equal(AdminAccess.SeedResult.AlreadyExists, await AdminAccess.EnsureAdminAsync(db, "altaParola"));

        Assert.Single(db.Users);
        var login = await service.LoginAsync(new LoginDto { Email = AdminAccess.AdminEmail, Password = Seed.DefaultPassword });
        Assert.Equal(LoginStatus.Success, login.Status);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123")]
    public async Task EnsureAdmin_NoValidPassword_CreatesNothing(string? password)
    {
        var db = TestDb.Create();

        Assert.Equal(AdminAccess.SeedResult.MissingPassword, await AdminAccess.EnsureAdminAsync(db, password));
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task ChangePassword_WrongCurrentPassword_IsRefused()
    {
        var (service, seed, db) = Setup();
        var user = seed.User();

        var error = await service.ChangePasswordAsync(user.Id, new ChangePasswordDto { CurrentPassword = "gresita", NewPassword = "noua123" });

        Assert.NotNull(error);
        Assert.True(BCrypt.Net.BCrypt.Verify(Seed.DefaultPassword, db.Users.Single().PasswordHash));
    }

    [Fact]
    public async Task ChangePassword_CorrectCurrentPassword_ChangesIt()
    {
        var (service, seed, db) = Setup();
        var user = seed.User();

        var error = await service.ChangePasswordAsync(user.Id, new ChangePasswordDto { CurrentPassword = Seed.DefaultPassword, NewPassword = "noua123" });

        Assert.Null(error);
        Assert.True(BCrypt.Net.BCrypt.Verify("noua123", db.Users.Single().PasswordHash));
    }

    [Fact]
    public async Task ChangePassword_GoogleOnlyAccount_CanSetFirstPasswordWithoutCurrent()
    {
        var (service, seed, db) = Setup();
        var user = seed.User(password: null, googleId: "google-sub-1");

        var error = await service.ChangePasswordAsync(user.Id, new ChangePasswordDto { NewPassword = "noua123" });

        Assert.Null(error);
        Assert.True(BCrypt.Net.BCrypt.Verify("noua123", db.Users.Single().PasswordHash));
    }

    [Fact]
    public async Task UpdateAvatar_UnknownKey_IsRefused()
    {
        var (service, seed, _) = Setup();
        var user = seed.User();

        var error = await service.UpdateAvatarAsync(user.Id, new UpdateAvatarDto { Avatar = "dinozaur-inexistent" });

        Assert.NotNull(error);
    }
}

// Logica de după validarea token-ului Google (fără apeluri reale către Google)
public class GoogleSignInTests
{
    private static (AuthService service, Seed seed, Data.AppDbContext db) Setup()
    {
        var db = TestDb.Create();
        return (new AuthService(db, TestConfig.Create()), new Seed(db), db);
    }

    [Fact]
    public async Task NewGoogleAccount_IsCreatedAndSignedIn()
    {
        var (service, _, db) = Setup();

        var result = await service.SignInWithGoogleAsync("sub-1", "nou@gmail.com", "Nou Google");

        Assert.Equal(LoginStatus.Success, result.Status);
        var user = db.Users.Single();
        Assert.Equal("sub-1", user.GoogleId);
        Assert.Null(user.PasswordHash);
    }

    [Fact]
    public async Task ExistingEmailAccount_GetsGoogleLinked()
    {
        var (service, seed, db) = Setup();
        var user = seed.User(email: "ana@gmail.com");

        var result = await service.SignInWithGoogleAsync("sub-ana", "ana@gmail.com", "Ana");

        Assert.Equal(LoginStatus.Success, result.Status);
        Assert.Equal("sub-ana", db.Users.Single(u => u.Id == user.Id).GoogleId);
    }

    [Fact]
    public async Task InactiveAccount_IsInactive()
    {
        var (service, seed, _) = Setup();
        seed.User(email: "ana@gmail.com", active: false);

        Assert.Equal(LoginStatus.Inactive, (await service.SignInWithGoogleAsync("sub-ana", "ana@gmail.com", "Ana")).Status);
    }

    [Theory]
    [InlineData("admin@admin.com")]
    [InlineData("ADMIN@admin.com")]
    public async Task AdminEmail_IsRefused_AndNothingIsCreatedOrLinked(string email)
    {
        var (service, seed, db) = Setup();
        var admin = seed.Admin();

        var result = await service.SignInWithGoogleAsync("sub-intrus", email, "Intrus");

        Assert.Equal(LoginStatus.InvalidCredentials, result.Status);
        Assert.Null(result.Response);
        Assert.Single(db.Users);
        Assert.Null(db.Users.Single(u => u.Id == admin.Id).GoogleId);
    }

    [Fact]
    public async Task AdminEmail_OnFreshDatabase_DoesNotCreateAdmin()
    {
        var (service, _, db) = Setup();

        Assert.Equal(LoginStatus.InvalidCredentials, (await service.SignInWithGoogleAsync("sub-x", AdminAccess.AdminEmail, "Intrus")).Status);
        Assert.Empty(db.Users);
    }

    // Un GoogleId legat de contul de admin înainte de regulă nu mai deschide contul
    [Fact]
    public async Task PreviouslyLinkedGoogleIdOnAdmin_IsRefused()
    {
        var (service, _, db) = Setup();
        db.Users.Add(new Models.User { Email = AdminAccess.AdminEmail, FullName = "Admin", GoogleId = "sub-vechi" });
        db.SaveChanges();

        var result = await service.SignInWithGoogleAsync("sub-vechi", "alt-email@gmail.com", "Oricine");

        Assert.Equal(LoginStatus.InvalidCredentials, result.Status);
    }
}

public class AuthControllerTests
{
    private static AuthController Setup(out Seed seed)
    {
        var db = TestDb.Create();
        seed = new Seed(db);
        return new AuthController(new AuthService(db, TestConfig.Create()), TestConfig.Create());
    }

    [Fact]
    public async Task Login_Success_Returns200()
    {
        var controller = Setup(out var seed);
        seed.User(email: "ana@test.ro");

        var result = await controller.Login(new LoginDto { Email = "ana@test.ro", Password = Seed.DefaultPassword });

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var controller = Setup(out var seed);
        seed.User(email: "ana@test.ro");

        var result = await controller.Login(new LoginDto { Email = "ana@test.ro", Password = "gresita" });

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Login_InactiveAccount_Returns403WithAccountInactiveCode()
    {
        var controller = Setup(out var seed);
        seed.User(email: "ana@test.ro", active: false);

        var result = await controller.Login(new LoginDto { Email = "ana@test.ro", Password = Seed.DefaultPassword });

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, obj.StatusCode);
        Assert.Equal("account_inactive", obj.Value!.GetType().GetProperty("code")!.GetValue(obj.Value));
    }
}

public class AccountStatusTests
{
    [Fact]
    public async Task IsActive_ReflectsUserState_AndNullForDeletedUser()
    {
        var db = TestDb.Create();
        var seed = new Seed(db);
        var active = seed.User(active: true);
        var inactive = seed.User(active: false);

        Assert.True(await AccountStatus.IsActiveAsync(db, active.Id));
        Assert.False(await AccountStatus.IsActiveAsync(db, inactive.Id));
        Assert.Null(await AccountStatus.IsActiveAsync(db, Guid.NewGuid()));
    }
}
