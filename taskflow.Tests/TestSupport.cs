using System.Security.Claims;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using taskflow.Data;
using taskflow.Models;
using taskflow.Services;
using TaskStatus = taskflow.Models.TaskStatus;

namespace taskflow.Tests;

// Bază de date EF Core InMemory — separată pentru fiecare test, fără nicio conexiune reală.
public static class TestDb
{
    public static AppDbContext Create() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"taskflow-tests-{Guid.NewGuid()}")
            .Options);
}

public static class TestConfig
{
    public static IConfiguration Create() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "cheie-de-test-doar-pentru-teste-unitare-minim-32-de-caractere-0123456789",
                ["Jwt:Issuer"] = "TaskFlowApi",
                ["Jwt:Audience"] = "TaskFlowClient",
            })
            .Build();
}

// IWebHostEnvironment minimal: serviciile îl folosesc doar pentru folderul de upload-uri.
public sealed class TestEnvironment : IWebHostEnvironment, IDisposable
{
    public string ContentRootPath { get; set; } =
        Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), $"taskflow-tests-{Guid.NewGuid():N}")).FullName;
    public string WebRootPath { get; set; } = "";
    public string EnvironmentName { get; set; } = "Testing";
    public string ApplicationName { get; set; } = "taskflow.Tests";
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();

    public string UploadsDir => Path.Combine(ContentRootPath, "uploads");

    public void Dispose()
    {
        try { Directory.Delete(ContentRootPath, recursive: true); } catch { /* best effort */ }
    }
}

// Creează rapid date de test; fiecare metodă salvează imediat.
public sealed class Seed(AppDbContext db)
{
    public const string DefaultPassword = "parola123";

    public User User(string name = "Utilizator", string? email = null, string? password = DefaultPassword,
        bool active = true, string? googleId = null)
    {
        var user = new User
        {
            FullName = name,
            Email = email ?? $"{Guid.NewGuid():N}@test.ro",
            // work factor mic: testele rămân rapide, Verify funcționează la fel
            PasswordHash = password is null ? null : BCrypt.Net.BCrypt.HashPassword(password, 4),
            IsActive = active,
            GoogleId = googleId,
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user;
    }

    public User Admin() => User("Admin", AdminAccess.AdminEmail);

    public Project Project(User owner, string name = "Proiect")
    {
        var project = new Project { Name = name, OwnerId = owner.Id };
        db.Projects.Add(project);
        db.SaveChanges();
        return project;
    }

    public TaskItem Task(Project project, string title, TaskStatus status = TaskStatus.Todo, int order = 0,
        DateTime? createdAt = null)
    {
        var task = new TaskItem
        {
            Title = title,
            ProjectId = project.Id,
            Status = status,
            Order = order,
            CreatedAt = createdAt ?? DateTime.UtcNow,
        };
        db.Tasks.Add(task);
        db.SaveChanges();
        return task;
    }

    public Group Group(int permissionLevel, params User[] members)
    {
        var group = new Group { Name = $"Grup {permissionLevel}", PermissionLevel = permissionLevel };
        db.Groups.Add(group);
        db.SaveChanges();
        foreach (var m in members)
            db.GroupUsers.Add(new GroupUser { GroupId = group.Id, UserId = m.Id });
        db.SaveChanges();
        return group;
    }

    public void Assign(Project project, Group group)
    {
        db.ProjectAssignments.Add(new ProjectAssignment { ProjectId = project.Id, GroupId = group.Id });
        db.SaveChanges();
    }

    public void Assign(Project project, User user)
    {
        db.ProjectAssignments.Add(new ProjectAssignment { ProjectId = project.Id, UserId = user.Id });
        db.SaveChanges();
    }

    // Utilizator nou, pus într-un grup cu nivelul dat și asignat proiectului prin grup
    public User MemberWithLevel(Project project, int level)
    {
        var user = User($"Membru nivel {level}");
        Assign(project, Group(level, user));
        return user;
    }

    public Tag Tag(string name = "tag")
    {
        var tag = new Tag { Name = name };
        db.Tags.Add(tag);
        db.SaveChanges();
        return tag;
    }
}

public static class ControllerTestExtensions
{
    // Setează utilizatorul logat, cu aceleași claim-uri ca token-ul JWT real (sub + email)
    public static T As<T>(this T controller, User user) where T : ControllerBase
    {
        var identity = new ClaimsIdentity(
        [
            new Claim("sub", user.Id.ToString()),
            new Claim("email", user.Email),
        ], "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }
}
