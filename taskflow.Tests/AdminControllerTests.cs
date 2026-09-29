using Microsoft.AspNetCore.Mvc;
using taskflow.Controllers;
using taskflow.Models;
using taskflow.Services;

namespace taskflow.Tests;

public class AdminControllerTests
{
    private readonly Data.AppDbContext _db = TestDb.Create();
    private readonly Seed _seed;
    private readonly User _admin;

    public AdminControllerTests()
    {
        _seed = new Seed(_db);
        _admin = _seed.Admin();
    }

    private AdminController AsAdmin() => new AdminController(_db).As(_admin);

    // ── acces ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task NonAdmin_IsForbiddenEverywhere()
    {
        var user = _seed.User();
        var controller = new AdminController(_db).As(user);

        Assert.IsType<ForbidResult>(await controller.GetStats());
        Assert.IsType<ForbidResult>(await controller.GetUsers());
        Assert.IsType<ForbidResult>(await controller.UpdateUserStatus(user.Id, new UpdateUserStatusDto(false)));
        Assert.IsType<ForbidResult>(await controller.DeleteUser(_admin.Id));
        Assert.IsType<ForbidResult>(await controller.CreateGroup(new CreateGroupDto("g", null)));
    }

    // ── utilizatori ───────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateUser_Validates_AndRejectsDuplicateEmail()
    {
        var controller = AsAdmin();
        _seed.User(email: "ana@test.ro");

        Assert.IsType<BadRequestObjectResult>(await controller.CreateUser(new CreateUserDto("x@test.ro", "X", "123")));
        Assert.IsType<BadRequestObjectResult>(await controller.CreateUser(new CreateUserDto("x@test.ro", "X", "parola123", "avatar-inexistent")));
        Assert.IsType<ConflictObjectResult>(await controller.CreateUser(new CreateUserDto("ana@test.ro", "Ana 2", "parola123")));
        Assert.IsType<OkObjectResult>(await controller.CreateUser(new CreateUserDto(" nou@test.ro ", " Nou ", "parola123", "fox")));

        var created = _db.Users.Single(u => u.Email == "nou@test.ro");
        Assert.Equal("Nou", created.FullName);
        Assert.Equal("fox", created.Avatar);
    }

    [Fact]
    public async Task Deactivate_RegularUser_Works()
    {
        var user = _seed.User();

        Assert.IsType<OkObjectResult>(await AsAdmin().UpdateUserStatus(user.Id, new UpdateUserStatusDto(false)));
        Assert.False(_db.Users.Single(u => u.Id == user.Id).IsActive);
    }

    [Fact]
    public async Task Deactivate_AdminAccount_IsRefused()
    {
        Assert.IsType<BadRequestObjectResult>(await AsAdmin().UpdateUserStatus(_admin.Id, new UpdateUserStatusDto(false)));
        Assert.True(_db.Users.Single(u => u.Id == _admin.Id).IsActive);
    }

    [Fact]
    public async Task UpdateName_ValidatesAndTrims()
    {
        var user = _seed.User("Vechi");
        var controller = AsAdmin();

        Assert.IsType<BadRequestObjectResult>(await controller.UpdateUserName(user.Id, new UpdateUserNameDto("   ")));
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateUserName(user.Id, new UpdateUserNameDto(new string('a', 101))));
        Assert.IsType<NotFoundResult>(await controller.UpdateUserName(Guid.NewGuid(), new UpdateUserNameDto("Nume")));
        Assert.IsType<OkObjectResult>(await controller.UpdateUserName(user.Id, new UpdateUserNameDto("  Nume Nou  ")));

        var stored = _db.Users.Single(u => u.Id == user.Id);
        Assert.Equal("Nume Nou", stored.FullName);
        Assert.True(BCrypt.Net.BCrypt.Verify(Seed.DefaultPassword, stored.PasswordHash)); // parola neatinsă
    }

    [Fact]
    public async Task UpdatePassword_ValidatesLength_AndDoesNotTouchName()
    {
        var user = _seed.User("Ana");
        var controller = AsAdmin();

        Assert.IsType<BadRequestObjectResult>(await controller.UpdateUserPassword(user.Id, new UpdateUserPasswordDto("123")));
        Assert.IsType<NoContentResult>(await controller.UpdateUserPassword(user.Id, new UpdateUserPasswordDto("parolanoua")));

        var stored = _db.Users.Single(u => u.Id == user.Id);
        Assert.True(BCrypt.Net.BCrypt.Verify("parolanoua", stored.PasswordHash));
        Assert.Equal("Ana", stored.FullName);
    }

    [Fact]
    public async Task DeleteUser_AdminAccount_IsRefused()
    {
        Assert.IsType<BadRequestObjectResult>(await AsAdmin().DeleteUser(_admin.Id));
        Assert.Contains(_db.Users, u => u.Id == _admin.Id);
    }

    [Fact]
    public async Task DeleteUser_KeepProjects_TransfersThemToAdmin()
    {
        var user = _seed.User();
        var project = _seed.Project(user);

        Assert.IsType<NoContentResult>(await AsAdmin().DeleteUser(user.Id, deleteProjects: false));

        Assert.DoesNotContain(_db.Users, u => u.Id == user.Id);
        Assert.Equal(_admin.Id, _db.Projects.Single(p => p.Id == project.Id).OwnerId);
    }

    [Fact]
    public async Task DeleteUser_WithProjects_RemovesThem()
    {
        var user = _seed.User();
        _seed.Project(user);

        Assert.IsType<NoContentResult>(await AsAdmin().DeleteUser(user.Id, deleteProjects: true));

        Assert.Empty(_db.Projects);
    }

    // ── grupuri ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateGroup_IgnoresUnknownUserIds()
    {
        var user = _seed.User();

        Assert.IsType<OkObjectResult>(await AsAdmin().CreateGroup(new CreateGroupDto(" Echipa ", [user.Id, Guid.NewGuid()])));

        var group = _db.Groups.Single();
        Assert.Equal("Echipa", group.Name);
        Assert.Equal([user.Id], _db.GroupUsers.Where(gu => gu.GroupId == group.Id).Select(gu => gu.UserId));
    }

    [Fact]
    public async Task CreateGroup_EmptyName_IsRefused()
    {
        Assert.IsType<BadRequestObjectResult>(await AsAdmin().CreateGroup(new CreateGroupDto("  ", null)));
    }

    // Pop-up-ul „Adaugă” trimite membrii existenți + cei noi — niciunul nu trebuie pierdut
    [Fact]
    public async Task UpdateGroup_WithMergedIds_KeepsExistingAndAddsNewMembers()
    {
        var existing = _seed.User("Existent");
        var added = _seed.User("Adăugat");
        var group = _seed.Group(2, existing);

        Assert.IsType<OkObjectResult>(await AsAdmin().UpdateGroup(group.Id, new CreateGroupDto(group.Name, [existing.Id, added.Id])));

        var members = _db.GroupUsers.Where(gu => gu.GroupId == group.Id).Select(gu => gu.UserId).ToHashSet();
        Assert.Equal(new HashSet<Guid> { existing.Id, added.Id }, members);
    }

    [Fact]
    public async Task UpdateGroup_RemovingMember_Works()
    {
        var a = _seed.User();
        var b = _seed.User();
        var group = _seed.Group(1, a, b);

        await AsAdmin().UpdateGroup(group.Id, new CreateGroupDto(group.Name, [a.Id]));

        Assert.Equal([a.Id], _db.GroupUsers.Where(gu => gu.GroupId == group.Id).Select(gu => gu.UserId));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    public async Task UpdatePermissions_OutOfRange_IsRefused(int level)
    {
        var group = _seed.Group(1);
        Assert.IsType<BadRequestObjectResult>(await AsAdmin().UpdatePermissions(group.Id, new UpdatePermissionDto(level)));
    }

    [Fact]
    public async Task UpdatePermissions_Valid_IsSaved()
    {
        var group = _seed.Group(1);

        Assert.IsType<OkObjectResult>(await AsAdmin().UpdatePermissions(group.Id, new UpdatePermissionDto(3)));
        Assert.Equal(3, _db.Groups.Single().PermissionLevel);
    }

    [Fact]
    public async Task DeleteGroup_RemovesGroupAndMemberships()
    {
        var group = _seed.Group(2, _seed.User(), _seed.User());

        Assert.IsType<NoContentResult>(await AsAdmin().DeleteGroup(group.Id));
        Assert.Empty(_db.Groups);
        Assert.Empty(_db.GroupUsers);
    }

    // ── asignări pe proiect ─────────────────────────────────────────────────────

    [Fact]
    public async Task Assign_ValidatesInput_AndRejectsDuplicates()
    {
        var project = _seed.Project(_seed.User());
        var user = _seed.User();
        var group = _seed.Group(1);
        var controller = AsAdmin();

        Assert.IsType<BadRequestObjectResult>(await controller.Assign(project.Id, new CreateAssignmentDto(null, null)));
        Assert.IsType<BadRequestObjectResult>(await controller.Assign(project.Id, new CreateAssignmentDto(user.Id, group.Id)));
        Assert.IsType<OkObjectResult>(await controller.Assign(project.Id, new CreateAssignmentDto(user.Id, null)));
        Assert.IsType<ConflictObjectResult>(await controller.Assign(project.Id, new CreateAssignmentDto(user.Id, null)));
        Assert.IsType<OkObjectResult>(await controller.Assign(project.Id, new CreateAssignmentDto(null, group.Id)));

        Assert.Equal(2, _db.ProjectAssignments.Count());
    }

    [Fact]
    public async Task RemoveAssignment_OnlyFromTheGivenProject()
    {
        var p1 = _seed.Project(_seed.User());
        var p2 = _seed.Project(_seed.User());
        _seed.Assign(p1, _seed.User());
        var assignmentId = _db.ProjectAssignments.Single().Id;

        Assert.IsType<NotFoundResult>(await AsAdmin().RemoveAssignment(p2.Id, assignmentId));
        Assert.IsType<NoContentResult>(await AsAdmin().RemoveAssignment(p1.Id, assignmentId));
        Assert.Empty(_db.ProjectAssignments);
    }

    [Fact]
    public async Task GetStats_CountsEverything()
    {
        var owner = _seed.User();
        var project = _seed.Project(owner);
        _seed.Task(project, "a");
        _seed.Task(project, "b");

        var ok = Assert.IsType<OkObjectResult>(await AsAdmin().GetStats());
        int Read(string name) => (int)ok.Value!.GetType().GetProperty(name)!.GetValue(ok.Value)!;

        Assert.Equal(2, Read("usersCount"));   // admin + owner
        Assert.Equal(1, Read("projectsCount"));
        Assert.Equal(2, Read("tasksCount"));
    }
}
