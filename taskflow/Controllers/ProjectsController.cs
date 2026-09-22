using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using taskflow.Data;
using taskflow.DTOs.Projects;
using taskflow.Services;

namespace taskflow.Controllers;

[Authorize]
[ApiController]
[Route("api/projects")]
public class ProjectsController(IProjectService projectService, AppDbContext db) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value!);

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var projects = await projectService.GetAllAsync(CurrentUserId);
        return Ok(projects);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var project = await projectService.GetByIdAsync(id, CurrentUserId);
        if (project is null) return NotFound();
        return Ok(project);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateProjectDto dto)
    {
        var project = await projectService.CreateAsync(dto, CurrentUserId);
        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateProjectDto dto)
    {
        var project = await projectService.UpdateAsync(id, dto, CurrentUserId);
        if (project is null) return NotFound();
        return Ok(project);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await projectService.DeleteAsync(id, CurrentUserId);
        if (!result) return NotFound();
        return NoContent();
    }

    // GET /api/projects/{id}/assignments
    [HttpGet("{id}/assignments")]
    public async Task<IActionResult> GetAssignments(Guid id)
    {
        var project = await db.Projects
            .Include(p => p.Owner)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null) return NotFound();

        var assignments = await db.ProjectAssignments
            .Where(pa => pa.ProjectId == id)
            .Include(pa => pa.User)
            .Include(pa => pa.Group)
            .Select(pa => new {
                pa.Id,
                Type = pa.UserId != null ? "user" : "group",
                Name = pa.UserId != null ? pa.User!.FullName : pa.Group!.Name,
                IsOwner = false
            })
            .ToListAsync();

        // Adauga owner-ul daca nu e deja in lista de asignati
        var ownerAlreadyAssigned = assignments.Any(a => a.Type == "user" && a.Name == project.Owner.FullName);

        var result = new List<object>();
        if (!ownerAlreadyAssigned)
        {
            result.Add(new { Id = -1, Type = "user", Name = project.Owner.FullName, IsOwner = true });
        }
        result.AddRange(assignments.Select(a => (object)new { a.Id, a.Type, a.Name, a.IsOwner }));

        return Ok(result);
    }
}