using Microsoft.EntityFrameworkCore;
using taskflow.Data;
using taskflow.DTOs.Tasks;
using taskflow.Models;

namespace taskflow.Services;

public interface ITaskService
{
    Task<List<TaskDto>> GetByProjectAsync(Guid projectId, Guid userId, string? status, Guid? tagId);
    Task<TaskDto?> GetByIdAsync(Guid id, Guid userId);
    Task<TaskDto?> CreateAsync(CreateTaskDto dto, Guid userId);
    Task<TaskDto?> UpdateAsync(Guid id, UpdateTaskDto dto, Guid userId);
    Task<TaskDto?> UpdateStatusAsync(Guid id, UpdateTaskStatusDto dto, Guid userId);
    Task<bool> ReorderAsync(Guid id, ReorderTaskDto dto, Guid userId);
    Task<bool> DeleteAsync(Guid id, Guid userId);
    Task<bool> AddTagAsync(Guid taskId, Guid tagId, Guid userId);
    Task<bool> RemoveTagAsync(Guid taskId, Guid tagId, Guid userId);
    Task<CommentDto?> AddCommentAsync(Guid taskId, CreateCommentDto dto, Guid userId);
    Task<TaskImageDto?> AddImageAsync(Guid taskId, IFormFile file, Guid userId);
    Task<bool> RemoveImageAsync(Guid taskId, Guid imageId, Guid userId);
    Task<(string Path, string ContentType)?> GetImageAsync(Guid taskId, Guid imageId, Guid userId);
}

public class TaskService(AppDbContext db, IWebHostEnvironment env) : ITaskService
{
    public const long MaxImageSize = 5 * 1024 * 1024;
    public const int MaxImagesPerTask = 20;

    private static readonly Dictionary<string, string> AllowedImageTypes = new()
    {
        ["image/png"] = ".png",
        ["image/jpeg"] = ".jpg",
        ["image/gif"] = ".gif",
        ["image/webp"] = ".webp",
    };

    private string UploadsDir => Path.Combine(env.ContentRootPath, "uploads");

    private void DeleteImageFile(string? fileName)
    {
        if (string.IsNullOrEmpty(fileName)) return;
        var path = Path.Combine(UploadsDir, fileName);
        if (File.Exists(path)) File.Delete(path);
    }

    // Returneaza true daca userul e owner, asignat direct, in grup asignat sau admin
    private async Task<bool> HasProjectAccessAsync(Guid projectId, Guid userId)
    {
        var isOwner = await db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerId == userId);
        if (isOwner) return true;
        if (await AdminAccess.IsAdminAsync(db, userId)) return true;

        var directAssign = await db.ProjectAssignments
            .AnyAsync(pa => pa.ProjectId == projectId && pa.UserId == userId);
        if (directAssign) return true;

        var userGroupIds = await db.GroupUsers
            .Where(gu => gu.UserId == userId)
            .Select(gu => gu.GroupId)
            .ToListAsync();

        return await db.ProjectAssignments
            .AnyAsync(pa => pa.ProjectId == projectId && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!));
    }

    // Nivelul de permisiune pe proiect, calculat la fel ca MyPermission din ProjectService:
    // 0 = fără acces, 1 = Vizualizare, 2 = Modificare, 3 = Ștergere
    private async Task<int> GetProjectPermissionAsync(Guid projectId, Guid userId)
    {
        var isOwner = await db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerId == userId);
        if (isOwner) return 3;
        if (await AdminAccess.IsAdminAsync(db, userId)) return 3;

        var directAssign = await db.ProjectAssignments
            .AnyAsync(pa => pa.ProjectId == projectId && pa.UserId == userId && pa.GroupId == null);
        if (directAssign) return 3;

        var userGroupIds = await db.GroupUsers
            .Where(gu => gu.UserId == userId)
            .Select(gu => gu.GroupId)
            .ToListAsync();

        var groupLevels = await db.ProjectAssignments
            .Where(pa => pa.ProjectId == projectId && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
            .Join(db.Groups, pa => (int)pa.GroupId!, g => g.Id, (pa, g) => g.PermissionLevel)
            .ToListAsync();

        return groupLevels.Count > 0 ? groupLevels.Max() : 0;
    }

    // Impune nivelul minim pe proiect (2 = Modificare, 3 = Ștergere), la fel ca interfața.
    // false = fără acces → apelantul răspunde ca și cum taskul nu ar exista (404);
    // aruncă UnauthorizedAccessException când există acces, dar nivelul e prea mic (403).
    private async Task<bool> EnsurePermissionAsync(Guid projectId, Guid userId, int minLevel)
    {
        var permission = await GetProjectPermissionAsync(projectId, userId);
        if (permission == 0) return false;
        if (permission < minLevel) throw new UnauthorizedAccessException();
        return true;
    }

    private const int CanModify = 2;
    private const int CanDelete = 3;

    private static TaskDto MapToDto(TaskItem t) => new()
    {
        Id = t.Id,
        Title = t.Title,
        Description = t.Description,
        Status = t.Status.ToString(),
        Priority = t.Priority.ToString(),
        DueDate = t.DueDate,
        CreatedAt = t.CreatedAt,
        Order = t.Order,
        ProjectId = t.ProjectId,
        AssigneeId = t.AssigneeId,
        Tags = t.TaskTags.Select(tt => new TagDto
        {
            Id = tt.Tag.Id,
            Name = tt.Tag.Name,
            Color = tt.Tag.Color
        }).ToList(),
        Comments = t.Comments.Select(c => new CommentDto
        {
            Id = c.Id,
            Text = c.Text,
            CreatedAt = c.CreatedAt,
            AuthorId = c.AuthorId,
            AuthorName = c.Author.FullName
        }).ToList(),
        Images = t.Images.OrderBy(i => i.CreatedAt).Select(i => new TaskImageDto
        {
            Id = i.Id,
            CreatedAt = i.CreatedAt
        }).ToList()
    };

    public async Task<List<TaskDto>> GetByProjectAsync(Guid projectId, Guid userId, string? status, Guid? tagId)
    {
        if (!await HasProjectAccessAsync(projectId, userId)) return [];

        var query = db.Tasks
            .AsNoTracking()
            .AsSplitQuery()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Include(t => t.Comments).ThenInclude(c => c.Author)
            .Include(t => t.Images)
            .Where(t => t.ProjectId == projectId);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<taskflow.Models.TaskStatus>(status, out var s))
            query = query.Where(t => t.Status == s);

        if (tagId.HasValue)
            query = query.Where(t => t.TaskTags.Any(tt => tt.TagId == tagId));

        var tasks = await query.OrderBy(t => t.Order).ThenBy(t => t.CreatedAt).ToListAsync();
        return tasks.Select(MapToDto).ToList();
    }

    public async Task<TaskDto?> GetByIdAsync(Guid id, Guid userId)
    {
        var task = await db.Tasks
            .AsNoTracking()
            .AsSplitQuery()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Include(t => t.Comments).ThenInclude(c => c.Author)
            .Include(t => t.Images)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null) return null;
        if (!await HasProjectAccessAsync(task.ProjectId, userId)) return null;

        return MapToDto(task);
    }

    public async Task<TaskDto?> CreateAsync(CreateTaskDto dto, Guid userId)
    {
        if (!await EnsurePermissionAsync(dto.ProjectId, userId, CanModify)) return null;

        var status = dto.Status ?? taskflow.Models.TaskStatus.Todo;

        var nextOrder = await db.Tasks
            .Where(t => t.ProjectId == dto.ProjectId && t.Status == status)
            .Select(t => (int?)t.Order)
            .MaxAsync() ?? -1;

        var task = new TaskItem
        {
            Title = dto.Title,
            Description = dto.Description,
            Priority = dto.Priority,
            DueDate = dto.DueDate,
            ProjectId = dto.ProjectId,
            AssigneeId = dto.AssigneeId,
            Status = status,
            Order = nextOrder + 1
        };

        db.Tasks.Add(task);
        await db.SaveChangesAsync();

        return await GetByIdAsync(task.Id, userId) ?? MapToDto(task);
    }

    public async Task<TaskDto?> UpdateAsync(Guid id, UpdateTaskDto dto, Guid userId)
    {
        var task = await db.Tasks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null || !await EnsurePermissionAsync(task.ProjectId, userId, CanModify)) return null;

        task.Title = dto.Title;
        task.Description = dto.Description;
        task.Priority = dto.Priority;
        task.DueDate = dto.DueDate;
        task.AssigneeId = dto.AssigneeId;

        await db.SaveChangesAsync();
        return await GetByIdAsync(id, userId);
    }

    public async Task<TaskDto?> UpdateStatusAsync(Guid id, UpdateTaskStatusDto dto, Guid userId)
    {
        var task = await db.Tasks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null || !await EnsurePermissionAsync(task.ProjectId, userId, CanModify)) return null;

        // Mutat în altă coloană (din pagina taskului) → la finalul ei, nu pe poziția veche
        if (task.Status != dto.Status)
        {
            var lastOrder = await db.Tasks
                .Where(t => t.ProjectId == task.ProjectId && t.Status == dto.Status && t.Id != id)
                .Select(t => (int?)t.Order)
                .MaxAsync() ?? -1;
            task.Order = lastOrder + 1;
        }
        task.Status = dto.Status;
        await db.SaveChangesAsync();
        return await GetByIdAsync(id, userId);
    }

    // Mută taskul pe o poziție (0-based) în coloana targetStatus, în cadrul aceluiași proiect.
    // Coloanele afectate sunt renumerotate complet (0..n-1), în aceeași ordine în care le
    // afișează GetByProjectAsync, așa că golurile/duplicatele din Order (după ștergeri sau
    // schimbări de status) nu mai deplasează poziția cerută.
    public async Task<bool> ReorderAsync(Guid id, ReorderTaskDto dto, Guid userId)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id);

        if (task is null || !await EnsurePermissionAsync(task.ProjectId, userId, CanModify)) return false;

        var oldStatus = task.Status;
        var newStatus = dto.Status;

        var others = await db.Tasks
            .Where(t => t.ProjectId == task.ProjectId && t.Id != id
                && (t.Status == oldStatus || t.Status == newStatus))
            .OrderBy(t => t.Order).ThenBy(t => t.CreatedAt)
            .ToListAsync();

        var targetColumn = others.Where(t => t.Status == newStatus).ToList();
        targetColumn.Insert(Math.Clamp(dto.Order, 0, targetColumn.Count), task);
        for (var i = 0; i < targetColumn.Count; i++) targetColumn[i].Order = i;

        if (oldStatus != newStatus)
        {
            var sourceColumn = others.Where(t => t.Status == oldStatus).ToList();
            for (var i = 0; i < sourceColumn.Count; i++) sourceColumn[i].Order = i;
        }

        task.Status = newStatus;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var task = await db.Tasks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null || !await EnsurePermissionAsync(task.ProjectId, userId, CanDelete)) return false;

        var imageFileNames = await db.TaskImages
            .Where(i => i.TaskItemId == id)
            .Select(i => i.FileName)
            .ToListAsync();

        db.Tasks.Remove(task);
        await db.SaveChangesAsync();
        imageFileNames.ForEach(DeleteImageFile);
        return true;
    }

    public async Task<bool> AddTagAsync(Guid taskId, Guid tagId, Guid userId)
    {
        var task = await db.Tasks.Include(t => t.Project).FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null || !await EnsurePermissionAsync(task.ProjectId, userId, CanModify)) return false;

        var exists = await db.TaskTags.AnyAsync(tt => tt.TaskItemId == taskId && tt.TagId == tagId);
        if (exists) return true;

        db.TaskTags.Add(new TaskTag { TaskItemId = taskId, TagId = tagId });
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveTagAsync(Guid taskId, Guid tagId, Guid userId)
    {
        var task = await db.Tasks.Include(t => t.Project).FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null || !await EnsurePermissionAsync(task.ProjectId, userId, CanModify)) return false;

        var taskTag = await db.TaskTags
            .FirstOrDefaultAsync(tt => tt.TaskItemId == taskId && tt.TagId == tagId);

        if (taskTag is null) return false;

        db.TaskTags.Remove(taskTag);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<CommentDto?> AddCommentAsync(Guid taskId, CreateCommentDto dto, Guid userId)
    {
        var task = await db.Tasks.Include(t => t.Project).FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null || !await EnsurePermissionAsync(task.ProjectId, userId, CanModify)) return null;

        var authorName = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? "";

        var comment = new Comment
        {
            Text = dto.Text,
            TaskItemId = taskId,
            AuthorId = userId
        };

        db.Comments.Add(comment);
        await db.SaveChangesAsync();

        return new CommentDto
        {
            Id = comment.Id,
            Text = comment.Text,
            CreatedAt = comment.CreatedAt,
            AuthorId = comment.AuthorId,
            AuthorName = authorName
        };
    }

    // Returnează null dacă taskul nu există / fără acces; aruncă ArgumentException pentru fișier invalid
    public async Task<TaskImageDto?> AddImageAsync(Guid taskId, IFormFile file, Guid userId)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null) return null;

        if (!await EnsurePermissionAsync(task.ProjectId, userId, CanModify)) return null;

        if (file.Length == 0 || file.Length > MaxImageSize)
            throw new ArgumentException("Imaginea trebuie să aibă maxim 5 MB.");
        if (!AllowedImageTypes.TryGetValue(file.ContentType, out var extension))
            throw new ArgumentException("Format acceptat: PNG, JPG, GIF sau WEBP.");
        if (await db.TaskImages.CountAsync(i => i.TaskItemId == taskId) >= MaxImagesPerTask)
            throw new ArgumentException($"Un task poate avea maxim {MaxImagesPerTask} imagini.");

        Directory.CreateDirectory(UploadsDir);
        var fileName = $"{taskId}_{Guid.NewGuid():N}{extension}";
        await using (var stream = File.Create(Path.Combine(UploadsDir, fileName)))
            await file.CopyToAsync(stream);

        var image = new TaskImage
        {
            TaskItemId = taskId,
            FileName = fileName,
            ContentType = file.ContentType
        };
        db.TaskImages.Add(image);
        await db.SaveChangesAsync();

        return new TaskImageDto { Id = image.Id, CreatedAt = image.CreatedAt };
    }

    public async Task<bool> RemoveImageAsync(Guid taskId, Guid imageId, Guid userId)
    {
        var image = await db.TaskImages
            .Include(i => i.TaskItem)
            .FirstOrDefaultAsync(i => i.Id == imageId && i.TaskItemId == taskId);
        if (image is null) return false;

        if (!await EnsurePermissionAsync(image.TaskItem.ProjectId, userId, CanModify)) return false;

        db.TaskImages.Remove(image);
        await db.SaveChangesAsync();
        DeleteImageFile(image.FileName);
        return true;
    }

    public async Task<(string Path, string ContentType)?> GetImageAsync(Guid taskId, Guid imageId, Guid userId)
    {
        var image = await db.TaskImages
            .Include(i => i.TaskItem)
            .FirstOrDefaultAsync(i => i.Id == imageId && i.TaskItemId == taskId);
        if (image is null || !await HasProjectAccessAsync(image.TaskItem.ProjectId, userId)) return null;

        var path = Path.Combine(UploadsDir, image.FileName);
        if (!File.Exists(path)) return null;
        return (path, image.ContentType);
    }
}
