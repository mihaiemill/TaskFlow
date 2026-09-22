using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using taskflow.Services;

namespace taskflow.Controllers;

[Authorize]
[ApiController]
[Route("api/tags")]
public class TagsController(ITagService tagService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var tags = await tagService.GetAllAsync();
        return Ok(tags);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTagRequest req)
    {
        var tag = await tagService.CreateAsync(req.Name, req.Color);
        return Ok(tag);
    }
}

public class CreateTagRequest
{
    public string Name { get; set; } = null!;
    public string Color { get; set; } = "#94a3b8";
}