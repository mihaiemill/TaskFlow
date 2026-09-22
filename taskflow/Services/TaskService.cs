using Microsoft.EntityFrameworkCore;
using taskflow.Data;
using taskflow.DTOs.Tasks;
using taskflow.Models;

namespace taskflow.Services;

public interface ITaskService
{
    Task<List<TaskDto>> GetByProjectAsync(Guid projectId, Guid userId, string? status, Guid? tagId);
    Task<TaskDto?> GetByIdAsync(Guid id, Guid userId);
    Task<TaskDto> CreateAsync(CreateTaskDto dto, Guid userId);
    Task<TaskDto?> UpdateAsync(Guid id, UpdateTaskDto dto, Guid userId);
    Task<TaskDto?> UpdateStatusAsync(Guid id, UpdateTaskStatusDto dto, Guid userId);
    Task<bool> ReorderAsync(Guid id, ReorderTaskDto dto, Guid userId);
    Task<bool> DeleteAsync(Guid id, Guid userId);
    Task<bool> AddTagAsync(Guid taskId, Guid tagId, Guid userId);
    Task<bool> RemoveTagAsync(Guid taskId, Guid tagId, Guid userId);
    Task<CommentDto?> AddCommentAsync(Guid taskId, CreateCommentDto dto, Guid userId);
}

public class TaskService(AppDbContext db) : ITaskService
{
    // Returneaza true daca userul e owner, asignat direct sau in grup asignat
    private async Task<bool> HasProjectAccessAsync(Guid projectId, Guid userId)
    {
        var isOwner = await db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerId == userId);
        if (isOwner) return true;

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
        }).ToList()
    };

    public async Task<List<TaskDto>> GetByProjectAsync(Guid projectId, Guid userId, string? status, Guid? tagId)
    {
        if (!await HasProjectAccessAsync(projectId, userId)) return [];

        var query = db.Tasks
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Include(t => t.Comments).ThenInclude(c => c.Author)
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
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Include(t => t.Comments).ThenInclude(c => c.Author)
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null) return null;
        if (!await HasProjectAccessAsync(task.ProjectId, userId)) return null;

        return MapToDto(task);
    }

    public async Task<TaskDto> CreateAsync(CreateTaskDto dto, Guid userId)
    {
        var nextOrder = await db.Tasks
            .Where(t => t.ProjectId == dto.ProjectId && t.Status == taskflow.Models.TaskStatus.Todo)
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

        if (task is null || !await HasProjectAccessAsync(task.ProjectId, userId)) return null;

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

        if (task is null || !await HasProjectAccessAsync(task.ProjectId, userId)) return null;

        task.Status = dto.Status;
        await db.SaveChangesAsync();
        return await GetByIdAsync(id, userId);
    }

    // Mută taskul pe o poziție (0-based) în coloana targetStatus, în cadrul aceluiași proiect,
    // renumerotând Order-ul celorlalte taskuri din coloana sursă și/sau destinație.
    public async Task<bool> ReorderAsync(Guid id, ReorderTaskDto dto, Guid userId)
    {
        var task = await db.Tasks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null || !await HasProjectAccessAsync(task.ProjectId, userId)) return false;

        var oldStatus = task.Status;
        var oldOrder = task.Order;
        var newStatus = dto.Status;

        var sourceColumnCount = await db.Tasks
            .CountAsync(t => t.ProjectId == task.ProjectId && t.Status == newStatus && t.Id != id);
        var newOrder = Math.Clamp(dto.Order, 0, sourceColumnCount);

        if (oldStatus == newStatus)
        {
            if (newOrder == oldOrder) return true;

            if (newOrder > oldOrder)
            {
                var affected = await db.Tasks
                    .Where(t => t.ProjectId == task.ProjectId && t.Status == oldStatus
                        && t.Order > oldOrder && t.Order <= newOrder && t.Id != id)
                    .ToListAsync();
                foreach (var t in affected) t.Order -= 1;
            }
            else
            {
                var affected = await db.Tasks
                    .Where(t => t.ProjectId == task.ProjectId && t.Status == oldStatus
                        && t.Order >= newOrder && t.Order < oldOrder && t.Id != id)
                    .ToListAsync();
                foreach (var t in affected) t.Order += 1;
            }
        }
        else
        {
            var oldColumnRemainder = await db.Tasks
                .Where(t => t.ProjectId == task.ProjectId && t.Status == oldStatus && t.Order > oldOrder)
                .ToListAsync();
            foreach (var t in oldColumnRemainder) t.Order -= 1;

            var newColumnShift = await db.Tasks
                .Where(t => t.ProjectId == task.ProjectId && t.Status == newStatus && t.Order >= newOrder)
                .ToListAsync();
            foreach (var t in newColumnShift) t.Order += 1;
        }

        task.Status = newStatus;
        task.Order = newOrder;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var task = await db.Tasks
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null || !await HasProjectAccessAsync(task.ProjectId, userId)) return false;

        db.Tasks.Remove(task);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AddTagAsync(Guid taskId, Guid tagId, Guid userId)
    {
        var task = await db.Tasks.Include(t => t.Project).FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null || !await HasProjectAccessAsync(task.ProjectId, userId)) return false;

        var exists = await db.TaskTags.AnyAsync(tt => tt.TaskItemId == taskId && tt.TagId == tagId);
        if (exists) return true;

        db.TaskTags.Add(new TaskTag { TaskItemId = taskId, TagId = tagId });
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveTagAsync(Guid taskId, Guid tagId, Guid userId)
    {
        var task = await db.Tasks.Include(t => t.Project).FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null || !await HasProjectAccessAsync(task.ProjectId, userId)) return false;

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
        if (task is null || !await HasProjectAccessAsync(task.ProjectId, userId)) return null;

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
}
