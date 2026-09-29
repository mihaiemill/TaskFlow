using taskflow.DTOs.Tasks;
using taskflow.Models;
using taskflow.Services;
using TaskStatus = taskflow.Models.TaskStatus;

namespace taskflow.Tests;

// Nivelurile: 1 = Vizualizare, 2 = Modificare, 3 = Ștergere (la fel ca în interfață)
public class TaskPermissionTests : IDisposable
{
    private readonly Data.AppDbContext _db = TestDb.Create();
    private readonly TestEnvironment _env = new();
    private readonly Seed _seed;
    private readonly TaskService _service;
    private readonly User _owner;
    private readonly Project _project;
    private readonly TaskItem _task;

    public TaskPermissionTests()
    {
        _seed = new Seed(_db);
        _service = new TaskService(_db, _env);
        _owner = _seed.User("Owner");
        _project = _seed.Project(_owner);
        _task = _seed.Task(_project, "Task existent");
    }

    public void Dispose() => _env.Dispose();

    private static UpdateTaskDto Edit => new() { Title = "Titlu nou" };
    private CreateTaskDto NewTask => new() { Title = "Task nou", ProjectId = _project.Id };

    // ── Vizualizare (1): poate citi, nu poate modifica nimic ────────────────────

    [Fact]
    public async Task Viewer_CanReadTasks()
    {
        var viewer = _seed.MemberWithLevel(_project, 1);

        Assert.Single(await _service.GetByProjectAsync(_project.Id, viewer.Id, null, null));
        Assert.NotNull(await _service.GetByIdAsync(_task.Id, viewer.Id));
    }

    [Fact]
    public async Task Viewer_CannotModifyAnything()
    {
        var viewer = _seed.MemberWithLevel(_project, 1);
        var tag = _seed.Tag();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.CreateAsync(NewTask, viewer.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.UpdateAsync(_task.Id, Edit, viewer.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.UpdateStatusAsync(_task.Id, new UpdateTaskStatusDto { Status = TaskStatus.Done }, viewer.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.ReorderAsync(_task.Id, new ReorderTaskDto { Status = TaskStatus.Done, Order = 0 }, viewer.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.AddTagAsync(_task.Id, tag.Id, viewer.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.RemoveTagAsync(_task.Id, tag.Id, viewer.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _service.AddCommentAsync(_task.Id, new CreateCommentDto { Text = "comentariu" }, viewer.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.DeleteAsync(_task.Id, viewer.Id));

        // nimic nu s-a schimbat în baza de test
        var stored = _db.Tasks.Single();
        Assert.Equal("Task existent", stored.Title);
        Assert.Equal(TaskStatus.Todo, stored.Status);
        Assert.Empty(_db.Comments);
        Assert.Empty(_db.TaskTags);
    }

    // ── Modificare (2): poate edita, nu poate șterge ────────────────────────────

    [Fact]
    public async Task Modifier_CanCreateEditMoveTagAndComment()
    {
        var modifier = _seed.MemberWithLevel(_project, 2);
        var tag = _seed.Tag();

        Assert.NotNull(await _service.CreateAsync(NewTask, modifier.Id));
        Assert.Equal("Titlu nou", (await _service.UpdateAsync(_task.Id, Edit, modifier.Id))!.Title);
        Assert.Equal("InProgress",
            (await _service.UpdateStatusAsync(_task.Id, new UpdateTaskStatusDto { Status = TaskStatus.InProgress }, modifier.Id))!.Status);
        Assert.True(await _service.ReorderAsync(_task.Id, new ReorderTaskDto { Status = TaskStatus.Done, Order = 0 }, modifier.Id));
        Assert.True(await _service.AddTagAsync(_task.Id, tag.Id, modifier.Id));
        Assert.NotNull(await _service.AddCommentAsync(_task.Id, new CreateCommentDto { Text = "ok" }, modifier.Id));
    }

    [Fact]
    public async Task Modifier_CannotDelete()
    {
        var modifier = _seed.MemberWithLevel(_project, 2);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.DeleteAsync(_task.Id, modifier.Id));
        Assert.Single(_db.Tasks);
    }

    // ── Ștergere (3) ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Deleter_CanDelete()
    {
        var deleter = _seed.MemberWithLevel(_project, 3);

        Assert.True(await _service.DeleteAsync(_task.Id, deleter.Id));
        Assert.Empty(_db.Tasks);
    }

    // ── Fără acces: totul arată ca „inexistent” (404), fără să dezvăluie proiectul ──

    [Fact]
    public async Task Outsider_SeesNothing_AndCannotChangeAnything()
    {
        var outsider = _seed.User("Străin");

        Assert.Empty(await _service.GetByProjectAsync(_project.Id, outsider.Id, null, null));
        Assert.Null(await _service.GetByIdAsync(_task.Id, outsider.Id));
        Assert.Null(await _service.CreateAsync(NewTask, outsider.Id));
        Assert.Null(await _service.UpdateAsync(_task.Id, Edit, outsider.Id));
        Assert.False(await _service.ReorderAsync(_task.Id, new ReorderTaskDto { Status = TaskStatus.Done }, outsider.Id));
        Assert.False(await _service.DeleteAsync(_task.Id, outsider.Id));
        Assert.Single(_db.Tasks);
    }

    [Fact]
    public async Task CreateTask_InNonexistentProject_ReturnsNull()
    {
        Assert.Null(await _service.CreateAsync(new CreateTaskDto { Title = "x", ProjectId = Guid.NewGuid() }, _owner.Id));
    }

    // ── Owner, asignare directă, admin, mai multe grupuri ───────────────────────

    [Fact]
    public async Task Owner_HasFullAccess()
    {
        Assert.NotNull(await _service.UpdateAsync(_task.Id, Edit, _owner.Id));
        Assert.True(await _service.DeleteAsync(_task.Id, _owner.Id));
    }

    [Fact]
    public async Task DirectlyAssignedUser_HasFullAccess()
    {
        var direct = _seed.User("Asignat direct");
        _seed.Assign(_project, direct);

        Assert.True(await _service.DeleteAsync(_task.Id, direct.Id));
    }

    [Fact]
    public async Task Admin_HasFullAccessWithoutAssignment()
    {
        var admin = _seed.Admin();

        Assert.NotNull(await _service.GetByIdAsync(_task.Id, admin.Id));
        Assert.NotNull(await _service.UpdateAsync(_task.Id, Edit, admin.Id));
        Assert.True(await _service.DeleteAsync(_task.Id, admin.Id));
    }

    [Fact]
    public async Task UserInSeveralGroups_GetsHighestLevel()
    {
        var user = _seed.User("În două grupuri");
        _seed.Assign(_project, _seed.Group(1, user));
        _seed.Assign(_project, _seed.Group(3, user));

        Assert.True(await _service.DeleteAsync(_task.Id, user.Id));
    }

    [Fact]
    public async Task GroupAssignedToOtherProject_GivesNoAccessHere()
    {
        var user = _seed.User();
        var otherProject = _seed.Project(_seed.User("Alt owner"), "Alt proiect");
        _seed.Assign(otherProject, _seed.Group(3, user));

        Assert.Null(await _service.GetByIdAsync(_task.Id, user.Id));
    }
}
