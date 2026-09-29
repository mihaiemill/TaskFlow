namespace taskflow.Models;

public enum TaskStatus { Todo, InProgress, Done }
public enum TaskPriority { Low, Medium, High }

public class TaskItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public TaskStatus Status { get; set; } = TaskStatus.Todo;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int Order { get; set; }

    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid? AssigneeId { get; set; }
    public User? Assignee { get; set; }

    public ICollection<TaskTag> TaskTags { get; set; } = [];
    public ICollection<Comment> Comments { get; set; } = [];
    public ICollection<TaskImage> Images { get; set; } = [];
}