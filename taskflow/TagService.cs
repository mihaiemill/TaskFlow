using Microsoft.EntityFrameworkCore;
using taskflow.Data;
using taskflow.DTOs.Tasks;
using taskflow.Models;

namespace taskflow.Services;

public interface ITagService
{
    Task<List<TagDto>> GetAllAsync();
    Task<TagDto> CreateAsync(string name, string color);
}

public class TagService(AppDbContext db) : ITagService
{
    public async Task<List<TagDto>> GetAllAsync()
    {
        return await db.Tags
            .Select(t => new TagDto
            {
                Id = t.Id,
                Name = t.Name,
                Color = t.Color
            })
            .ToListAsync();
    }

    public async Task<TagDto> CreateAsync(string name, string color)
    {
        var tag = new Tag { Name = name, Color = color };
        db.Tags.Add(tag);
        await db.SaveChangesAsync();
        return new TagDto { Id = tag.Id, Name = tag.Name, Color = tag.Color };
    }
}