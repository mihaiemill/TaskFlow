using System.ComponentModel.DataAnnotations;

namespace taskflow.DTOs.Projects;


public class ProjectDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Color { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public int RemainingTasks { get; set; }
    public int TotalTasks { get; set; }
    public int MyPermission { get; set; }
}

public class CreateProjectDto
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = null!;

    [MaxLength(500)]
    public string? Description { get; set; }

    public string Color { get; set; } = "#6366f1";
}

public class UpdateProjectDto
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = null!;

    [MaxLength(500)]
    public string? Description { get; set; }

    public string Color { get; set; } = "#6366f1";
}