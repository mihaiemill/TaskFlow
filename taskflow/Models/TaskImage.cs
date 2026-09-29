namespace taskflow.Models;

public class TaskImage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    
    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;
}
