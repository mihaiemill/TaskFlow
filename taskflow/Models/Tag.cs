namespace taskflow.Models;

public class Tag
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;
    public string Color { get; set; } = "#94a3b8";

    public ICollection<TaskTag> TaskTags { get; set; } = [];
}