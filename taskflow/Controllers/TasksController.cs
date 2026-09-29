using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using taskflow.DTOs.Tasks;
using taskflow.Services;

namespace taskflow.Controllers;

[Authorize]
[ApiController]
[ForbidOnUnauthorizedAccess]
public class TasksController(ITaskService taskService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value!);

    [HttpGet("api/projects/{projectId}/tasks")]
    public async Task<IActionResult> GetByProject(Guid projectId, [FromQuery] string? status, [FromQuery] Guid? tagId)
    {
        var tasks = await taskService.GetByProjectAsync(projectId, CurrentUserId, status, tagId);
        return Ok(tasks);
    }

    [HttpGet("api/tasks/{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var task = await taskService.GetByIdAsync(id, CurrentUserId);
        if (task is null) return NotFound();
        return Ok(task);
    }

    [HttpPost("api/tasks")]
    public async Task<IActionResult> Create(CreateTaskDto dto)
    {
        var task = await taskService.CreateAsync(dto, CurrentUserId);
        if (task is null) return NotFound();
        return CreatedAtAction(nameof(GetById), new { id = task.Id }, task);
    }

    [HttpPut("api/tasks/{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateTaskDto dto)
    {
        var task = await taskService.UpdateAsync(id, dto, CurrentUserId);
        if (task is null) return NotFound();
        return Ok(task);
    }

    [HttpPatch("api/tasks/{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, UpdateTaskStatusDto dto)
    {
        var task = await taskService.UpdateStatusAsync(id, dto, CurrentUserId);
        if (task is null) return NotFound();
        return Ok(task);
    }

    [HttpPatch("api/tasks/{id}/reorder")]
    public async Task<IActionResult> Reorder(Guid id, ReorderTaskDto dto)
    {
        var result = await taskService.ReorderAsync(id, dto, CurrentUserId);
        if (!result) return NotFound();
        return NoContent();
    }

    [HttpDelete("api/tasks/{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await taskService.DeleteAsync(id, CurrentUserId);
        if (!result) return NotFound();
        return NoContent();
    }

    [HttpPost("api/tasks/{taskId}/tags/{tagId}")]
    public async Task<IActionResult> AddTag(Guid taskId, Guid tagId)
    {
        var result = await taskService.AddTagAsync(taskId, tagId, CurrentUserId);
        if (!result) return NotFound();
        return Ok();
    }

    [HttpDelete("api/tasks/{taskId}/tags/{tagId}")]
    public async Task<IActionResult> RemoveTag(Guid taskId, Guid tagId)
    {
        var result = await taskService.RemoveTagAsync(taskId, tagId, CurrentUserId);
        if (!result) return NotFound();
        return NoContent();
    }

    [HttpPost("api/tasks/{taskId}/comments")]
    public async Task<IActionResult> AddComment(Guid taskId, CreateCommentDto dto)
    {
        var comment = await taskService.AddCommentAsync(taskId, dto, CurrentUserId);
        if (comment is null) return NotFound();
        return Ok(comment);
    }

    [HttpGet("api/tasks/{taskId}/images/{imageId}")]
    public async Task<IActionResult> GetImage(Guid taskId, Guid imageId)
    {
        var image = await taskService.GetImageAsync(taskId, imageId, CurrentUserId);
        if (image is null) return NotFound();
        return PhysicalFile(image.Value.Path, image.Value.ContentType);
    }

    [HttpPost("api/tasks/{taskId}/images")]
    [RequestSizeLimit(TaskService.MaxImageSize + 64 * 1024)]
    public async Task<IActionResult> UploadImage(Guid taskId, IFormFile file)
    {
        try
        {
            var image = await taskService.AddImageAsync(taskId, file, CurrentUserId);
            if (image is null) return NotFound();
            return Ok(image);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("api/tasks/{taskId}/images/{imageId}")]
    public async Task<IActionResult> DeleteImage(Guid taskId, Guid imageId)
    {
        var result = await taskService.RemoveImageAsync(taskId, imageId, CurrentUserId);
        if (!result) return NotFound();
        return NoContent();
    }
}