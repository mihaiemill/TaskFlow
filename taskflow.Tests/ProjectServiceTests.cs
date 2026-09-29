using taskflow.DTOs.Projects;
using taskflow.Models;
using taskflow.Services;

namespace taskflow.Tests;

public class ProjectServiceTests : IDisposable
{
    private readonly Data.AppDbContext _db = TestDb.Create();
    private readonly TestEnvironment _env = new();
    private readonly Seed _seed;
    private readonly ProjectService _service;
    private readonly User _owner;
    private readonly Project _project;

    public ProjectServiceTests()
    {
        _seed = new Seed(_db);
        _service = new ProjectService(_db, _env);
        _owner = _seed.User("Owner");
        _project = _seed.Project(_owner, "Proiectul lui Owner");
    }

    public void Dispose() => _env.Dispose();

    private static UpdateProjectDto Rename => new() { Name = "Redenumit", Color = "#000000" };

    [Fact]
    public async Task GetAll_ReturnsOwnedAndAssignedProjects_NotOthers()
    {
        var user = _seed.User("Ana");
        var own = _seed.Project(user, "Al Anei");
        var viaGroup = _seed.Project(_seed.User(), "Prin grup");
        _seed.Assign(viaGroup, _seed.Group(2, user));
        var direct = _seed.Project(_seed.User(), "Direct");
        _seed.Assign(direct, user);
        _seed.Project(_seed.User(), "Străin");

        var names = (await _service.GetAllAsync(user.Id)).Select(p => p.Name).OrderBy(n => n);

        Assert.Equal(["Al Anei", "Direct", "Prin grup"], names);
    }

    [Fact]
    public async Task MyPermission_IsComputedPerAccessType()
    {
        var user = _seed.User();
        var own = _seed.Project(user, "own");
        var viewer = _seed.Project(_seed.User(), "viewer");
        _seed.Assign(viewer, _seed.Group(1, user));
        var both = _seed.Project(_seed.User(), "both");
        _seed.Assign(both, _seed.Group(1, user));
        _seed.Assign(both, _seed.Group(2, user));
        var direct = _seed.Project(_seed.User(), "direct");
        _seed.Assign(direct, user);

        var perms = (await _service.GetAllAsync(user.Id)).ToDictionary(p => p.Name, p => p.MyPermission);

        Assert.Equal(3, perms["own"]);
        Assert.Equal(1, perms["viewer"]);
        Assert.Equal(2, perms["both"]);   // cel mai mare nivel dintre grupuri
        Assert.Equal(3, perms["direct"]);
    }

    [Fact]
    public async Task GetById_Outsider_ReturnsNull()
    {
        Assert.Null(await _service.GetByIdAsync(_project.Id, _seed.User().Id));
    }

    [Fact]
    public async Task GetById_Admin_SeesAnyProjectWithFullPermission()
    {
        var project = await _service.GetByIdAsync(_project.Id, _seed.Admin().Id);

        Assert.NotNull(project);
        Assert.Equal(3, project.MyPermission);
    }

    [Fact]
    public async Task Update_Viewer_IsRefused_Modifier_IsAllowed()
    {
        var viewer = _seed.MemberWithLevel(_project, 1);
        var modifier = _seed.MemberWithLevel(_project, 2);

        Assert.Null(await _service.UpdateAsync(_project.Id, Rename, viewer.Id));
        Assert.Equal("Proiectul lui Owner", _db.Projects.Single(p => p.Id == _project.Id).Name);

        Assert.Equal("Redenumit", (await _service.UpdateAsync(_project.Id, Rename, modifier.Id))!.Name);
    }

    [Fact]
    public async Task Delete_Modifier_IsRefused_Deleter_IsAllowed()
    {
        var modifier = _seed.MemberWithLevel(_project, 2);
        var deleter = _seed.MemberWithLevel(_project, 3);

        Assert.False(await _service.DeleteAsync(_project.Id, modifier.Id));
        Assert.True(await _service.DeleteAsync(_project.Id, deleter.Id));
        Assert.Empty(_db.Projects.Where(p => p.Id == _project.Id));
    }

    [Fact]
    public async Task Admin_CanUpdateAndDeleteAnyProject()
    {
        var admin = _seed.Admin();

        Assert.NotNull(await _service.UpdateAsync(_project.Id, Rename, admin.Id));
        Assert.True(await _service.DeleteAsync(_project.Id, admin.Id));
    }

    [Fact]
    public async Task Create_SetsCurrentUserAsOwner()
    {
        var user = _seed.User();

        var created = await _service.CreateAsync(new CreateProjectDto { Name = "Nou" }, user.Id);

        Assert.Equal(user.Id, _db.Projects.Single(p => p.Id == created.Id).OwnerId);
    }
}
