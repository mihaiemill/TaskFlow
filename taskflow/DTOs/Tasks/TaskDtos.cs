using System.ComponentModel.DataAnnotations;
using taskflow.Models;

namespace taskflow.DTOs.Tasks;

// DTOs/TaskSearchResultDto.cs
public class TaskSearchResultDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
}

public class TaskDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string Status { get; set; } = null!;
    public string Priority { get; set; } = null!;
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public int Order { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? AssigneeId { get; set; }
    public List<TagDto> Tags { get; set; } = [];
    public List<CommentDto> Comments { get; set; } = [];
    public List<TaskImageDto> Images { get; set; } = [];
}

public class TaskImageDto
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TagDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Color { get; set; } = null!;
}

public class CommentDto
{
    public Guid Id { get; set; }
    public string Text { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = null!;
}

public class CreateTaskDto
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = null!;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    public DateTime? DueDate { get; set; }

    [Required]
    public Guid ProjectId { get; set; }

    public Guid? AssigneeId { get; set; }

    public taskflow.Models.TaskStatus? Status { get; set; }
}

public class UpdateTaskDto
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = null!;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    public DateTime? DueDate { get; set; }

    public Guid? AssigneeId { get; set; }
}

public class UpdateTaskStatusDto
{
    [Required]
    public taskflow.Models.TaskStatus Status { get; set; }
}

public class ReorderTaskDto
{
    [Required]
    public taskflow.Models.TaskStatus Status { get; set; }

    // Poziția (0-based) taskului în noua coloană, după mutare
    [Range(0, int.MaxValue)]
    public int Order { get; set; }
}

public class CreateCommentDto
{
    [Required, MaxLength(1000)]
    public string Text { get; set; } = null!;
}