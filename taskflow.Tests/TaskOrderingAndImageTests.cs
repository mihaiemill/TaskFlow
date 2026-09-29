using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using taskflow.Controllers;
using taskflow.DTOs.Tasks;
using taskflow.Models;
using taskflow.Services;
using TaskStatus = taskflow.Models.TaskStatus;

namespace taskflow.Tests;

// Drag & drop: ReorderAsync + ordinea în care GetByProjectAsync întoarce taskurile
public class TaskReorderTests : IDisposable
{
    private readonly Data.AppDbContext _db = TestDb.Create();
    private readonly TestEnvironment _env = new();
    private readonly Seed _seed;
    private readonly TaskService _service;
    private readonly User _owner;
    private readonly Project _project;

    public TaskReorderTests()
    {
        _seed = new Seed(_db);
        _service = new TaskService(_db, _env);
        _owner = _seed.User();
        _project = _seed.Project(_owner);
    }

    public void Dispose() => _env.Dispose();

    private async Task<string[]> Column(TaskStatus status) =>
        (await _service.GetByProjectAsync(_project.Id, _owner.Id, null, null))
            .Where(t => t.Status == status.ToString())
            .Select(t => t.Title)
            .ToArray();

    private Task<bool> Move(TaskItem task, TaskStatus status, int order) =>
        _service.ReorderAsync(task.Id, new ReorderTaskDto { Status = status, Order = order }, _owner.Id);

    [Fact]
    public async Task SameColumn_MoveDown()
    {
        var a = _seed.Task(_project, "A", order: 0);
        _seed.Task(_project, "B", order: 1);
        _seed.Task(_project, "C", order: 2);

        await Move(a, TaskStatus.Todo, 2);

        Assert.Equal(["B", "C", "A"], await Column(TaskStatus.Todo));
    }

    [Fact]
    public async Task SameColumn_MoveDownByOne()
    {
        var a = _seed.Task(_project, "A", order: 0);
        _seed.Task(_project, "B", order: 1);
        _seed.Task(_project, "C", order: 2);

        await Move(a, TaskStatus.Todo, 1);

        Assert.Equal(["B", "A", "C"], await Column(TaskStatus.Todo));
    }

    [Fact]
    public async Task SameColumn_MoveUp()
    {
        _seed.Task(_project, "A", order: 0);
        _seed.Task(_project, "B", order: 1);
        var c = _seed.Task(_project, "C", order: 2);

        await Move(c, TaskStatus.Todo, 0);

        Assert.Equal(["C", "A", "B"], await Column(TaskStatus.Todo));
    }

    [Fact]
    public async Task CrossColumn_InsertsAtPosition_AndClosesGapInSource()
    {
        var a = _seed.Task(_project, "A", TaskStatus.Todo, 0);
        _seed.Task(_project, "B", TaskStatus.Todo, 1);
        _seed.Task(_project, "X", TaskStatus.Done, 0);
        _seed.Task(_project, "Y", TaskStatus.Done, 1);

        await Move(a, TaskStatus.Done, 1);

        Assert.Equal(["B"], await Column(TaskStatus.Todo));
        Assert.Equal(["X", "A", "Y"], await Column(TaskStatus.Done));
        Assert.Equal([0], _db.Tasks.Where(t => t.Status == TaskStatus.Todo).Select(t => t.Order));
        Assert.Equal([0, 1, 2], _db.Tasks.Where(t => t.Status == TaskStatus.Done).OrderBy(t => t.Order).Select(t => t.Order));
    }

    [Fact]
    public async Task CrossColumn_IntoEmptyColumn()
    {
        var a = _seed.Task(_project, "A", TaskStatus.Todo, 0);

        await Move(a, TaskStatus.InProgress, 0);

        Assert.Empty(await Column(TaskStatus.Todo));
        Assert.Equal(["A"], await Column(TaskStatus.InProgress));
    }

    [Fact]
    public async Task OrderBeyondColumnLength_GoesToEnd()
    {
        var a = _seed.Task(_project, "A", order: 0);
        _seed.Task(_project, "B", order: 1);

        await Move(a, TaskStatus.Todo, 99);

        Assert.Equal(["B", "A"], await Column(TaskStatus.Todo));
    }

    // Goluri și duplicate în Order (după ștergeri / schimbări de status) nu mai strică poziția
    [Fact]
    public async Task GapsAndDuplicatesInOrder_AreRenumbered()
    {
        var t0 = DateTime.UtcNow;
        _seed.Task(_project, "A", order: 0, createdAt: t0);
        _seed.Task(_project, "B", order: 5, createdAt: t0.AddSeconds(1));
        _seed.Task(_project, "C", order: 5, createdAt: t0.AddSeconds(2));
        var d = _seed.Task(_project, "D", order: 9, createdAt: t0.AddSeconds(3));

        await Move(d, TaskStatus.Todo, 1);

        Assert.Equal(["A", "D", "B", "C"], await Column(TaskStatus.Todo));
        Assert.Equal([0, 1, 2, 3], _db.Tasks.OrderBy(t => t.Order).Select(t => t.Order));
    }

    [Fact]
    public async Task CreateTask_IsAppendedAtEndOfColumn()
    {
        _seed.Task(_project, "A", order: 0);
        _seed.Task(_project, "B", order: 1);

        var created = await _service.CreateAsync(new CreateTaskDto { Title = "C", ProjectId = _project.Id }, _owner.Id);

        Assert.Equal(2, created!.Order);
        Assert.Equal(["A", "B", "C"], await Column(TaskStatus.Todo));
    }

    // Regresie pentru bug-ul #14: schimbarea statusului din pagina taskului îl pune la finalul coloanei noi.
    [Fact]
    public async Task UpdateStatus_PlacesTaskAtEndOfNewColumn()
    {
        _seed.Task(_project, "X", TaskStatus.Done, 0);
        _seed.Task(_project, "Y", TaskStatus.Done, 1);
        var a = _seed.Task(_project, "A", TaskStatus.Todo, 0);

        await _service.UpdateStatusAsync(a.Id, new UpdateTaskStatusDto { Status = TaskStatus.Done }, _owner.Id);

        Assert.Equal(["X", "Y", "A"], await Column(TaskStatus.Done));
    }

    [Fact]
    public async Task UpdateStatus_SameStatus_KeepsPosition()
    {
        var a = _seed.Task(_project, "A", order: 0);
        _seed.Task(_project, "B", order: 1);

        await _service.UpdateStatusAsync(a.Id, new UpdateTaskStatusDto { Status = TaskStatus.Todo }, _owner.Id);

        Assert.Equal(["A", "B"], await Column(TaskStatus.Todo));
    }
}

public class TaskImageTests : IDisposable
{
    private readonly Data.AppDbContext _db = TestDb.Create();
    private readonly TestEnvironment _env = new();
    private readonly Seed _seed;
    private readonly TaskService _service;
    private readonly User _owner;
    private readonly Project _project;
    private readonly TaskItem _task;

    public TaskImageTests()
    {
        _seed = new Seed(_db);
        _service = new TaskService(_db, _env);
        _owner = _seed.User();
        _project = _seed.Project(_owner);
        _task = _seed.Task(_project, "Cu imagini");
    }

    public void Dispose() => _env.Dispose();

    private static IFormFile File(string contentType, int size = 64)
    {
        var bytes = new byte[size];
        return new FormFile(new MemoryStream(bytes), 0, size, "file", "imagine")
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };
    }

    [Fact]
    public async Task Upload_ValidImage_SavesFile_AndDeleteRemovesIt()
    {
        var image = await _service.AddImageAsync(_task.Id, File("image/png"), _owner.Id);

        Assert.NotNull(image);
        var fileName = _db.TaskImages.Single().FileName;
        Assert.True(System.IO.File.Exists(Path.Combine(_env.UploadsDir, fileName)));

        Assert.True(await _service.RemoveImageAsync(_task.Id, image.Id, _owner.Id));
        Assert.False(System.IO.File.Exists(Path.Combine(_env.UploadsDir, fileName)));
    }

    [Fact]
    public async Task Upload_UnsupportedType_IsRefused()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => _service.AddImageAsync(_task.Id, File("application/pdf"), _owner.Id));
    }

    [Fact]
    public async Task Upload_TooLarge_IsRefused()
    {
        var tooLarge = File("image/png", (int)TaskService.MaxImageSize + 1);
        await Assert.ThrowsAsync<ArgumentException>(() => _service.AddImageAsync(_task.Id, tooLarge, _owner.Id));
    }

    [Fact]
    public async Task Upload_ByViewer_IsForbidden()
    {
        var viewer = _seed.MemberWithLevel(_project, 1);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.AddImageAsync(_task.Id, File("image/png"), viewer.Id));
    }

    [Fact]
    public async Task DeleteTask_RemovesImageFilesFromDisk()
    {
        await _service.AddImageAsync(_task.Id, File("image/png"), _owner.Id);
        var path = Path.Combine(_env.UploadsDir, _db.TaskImages.Single().FileName);

        await _service.DeleteAsync(_task.Id, _owner.Id);

        Assert.False(System.IO.File.Exists(path));
    }
}

public class ForbidOnUnauthorizedAccessFilterTests
{
    private static ExceptionContext Context(Exception ex) =>
        new(new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()), new List<IFilterMetadata>())
        {
            Exception = ex
        };

    [Fact]
    public void UnauthorizedAccess_BecomesForbidden403()
    {
        var ctx = Context(new UnauthorizedAccessException());

        new ForbidOnUnauthorizedAccessAttribute().OnException(ctx);

        Assert.True(ctx.ExceptionHandled);
        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(ctx.Result).StatusCode);
    }

    [Fact]
    public void OtherExceptions_AreLeftAlone()
    {
        var ctx = Context(new InvalidOperationException());

        new ForbidOnUnauthorizedAccessAttribute().OnException(ctx);

        Assert.False(ctx.ExceptionHandled);
        Assert.Null(ctx.Result);
    }
}
