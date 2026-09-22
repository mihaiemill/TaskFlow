using Microsoft.EntityFrameworkCore;
using taskflow.Data;
using taskflow.DTOs.Projects;
using taskflow.Models;

namespace taskflow.Services;

public interface IProjectService
{
    Task<List<ProjectDto>> GetAllAsync(Guid userId);
    Task<ProjectDto?> GetByIdAsync(Guid id, Guid userId);
    Task<ProjectDto> CreateAsync(CreateProjectDto dto, Guid userId);
    Task<ProjectDto?> UpdateAsync(Guid id, UpdateProjectDto dto, Guid userId);
    Task<bool> DeleteAsync(Guid id, Guid userId);
}

public class ProjectService(AppDbContext db) : IProjectService
{
    public async Task<List<ProjectDto>> GetAllAsync(Guid userId)
    {
        // grupurile utilizatorului + nivelul de permisiune al fiecăruia
        var userGroupPerms = await db.GroupUsers
            .Where(gu => gu.UserId == userId)
            .Include(gu => gu.Group)
            .ToDictionaryAsync(gu => gu.GroupId, gu => gu.Group.PermissionLevel);

        var userGroupIds = userGroupPerms.Keys.ToList();

        var projectsList = await db.Projects
            .Include(p => p.Tasks)
            .Where(p =>
                p.OwnerId == userId
                || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.UserId == userId)
                || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!)))
            .ToListAsync();

        var projectIds = projectsList.Select(p => p.Id).ToList();

        // asignări prin grup (cu nivelul permisiunii)
        var groupAssignments = await db.ProjectAssignments
            .Where(pa => projectIds.Contains(pa.ProjectId) && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
            .Select(pa => new { pa.ProjectId, GroupId = (int)pa.GroupId! })
            .ToListAsync();

        // asignări directe pe user (fără grup) → drepturi depline
        var directAssignmentProjectIds = await db.ProjectAssignments
            .Where(pa => projectIds.Contains(pa.ProjectId) && pa.UserId == userId && pa.GroupId == null)
            .Select(pa => pa.ProjectId)
            .ToListAsync();

        return projectsList.Select(p =>
        {
            // creatorul proiectului are întotdeauna drepturi depline
            if (p.OwnerId == userId)
                return new ProjectDto { Id = p.Id, Name = p.Name, Description = p.Description, Color = p.Color, CreatedAt = p.CreatedAt, TotalTasks = p.Tasks.Count, RemainingTasks = p.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done), MyPermission = 3 };

            // asignat direct pe user (nu prin grup) → drepturi depline
            if (directAssignmentProjectIds.Contains(p.Id))
                return new ProjectDto { Id = p.Id, Name = p.Name, Description = p.Description, Color = p.Color, CreatedAt = p.CreatedAt, TotalTasks = p.Tasks.Count, RemainingTasks = p.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done), MyPermission = 3 };

            var perms = groupAssignments
                .Where(ga => ga.ProjectId == p.Id && userGroupPerms.ContainsKey(ga.GroupId))
                .Select(ga => userGroupPerms[ga.GroupId])
                .ToList();
            int perm = perms.Any() ? perms.Max() : 1;

            return new ProjectDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                Color = p.Color,
                CreatedAt = p.CreatedAt,
                TotalTasks = p.Tasks.Count,
                RemainingTasks = p.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done),
                MyPermission = perm
            };
        }).ToList();
    }

    public async Task<ProjectDto?> GetByIdAsync(Guid id, Guid userId)
    {
        var userGroupPerms = await db.GroupUsers
            .Where(gu => gu.UserId == userId)
            .Include(gu => gu.Group)
            .ToDictionaryAsync(gu => gu.GroupId, gu => gu.Group.PermissionLevel);

        var userGroupIds = userGroupPerms.Keys.ToList();

        var project = await db.Projects
            .Include(p => p.Tasks)
            .Where(p =>
                p.Id == id
                && (
                    p.OwnerId == userId
                    || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.UserId == userId)
                    || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
                ))
            .FirstOrDefaultAsync();

        if (project is null) return null;

        // creatorul proiectului are întotdeauna drepturi depline
        if (project.OwnerId == userId)
            return new ProjectDto { Id = project.Id, Name = project.Name, Description = project.Description, Color = project.Color, CreatedAt = project.CreatedAt, TotalTasks = project.Tasks.Count, RemainingTasks = project.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done), MyPermission = 3 };

        // asignat direct pe user (nu prin grup) → drepturi depline
        var hasDirectAssignment = await db.ProjectAssignments
            .AnyAsync(pa => pa.ProjectId == id && pa.UserId == userId && pa.GroupId == null);

        if (hasDirectAssignment)
            return new ProjectDto { Id = project.Id, Name = project.Name, Description = project.Description, Color = project.Color, CreatedAt = project.CreatedAt, TotalTasks = project.Tasks.Count, RemainingTasks = project.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done), MyPermission = 3 };

        var groupIds = await db.ProjectAssignments
            .Where(pa => pa.ProjectId == id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
            .Select(pa => (int)pa.GroupId!)
            .ToListAsync();

        int perm = groupIds.Any(gid => userGroupPerms.ContainsKey(gid))
            ? groupIds.Where(gid => userGroupPerms.ContainsKey(gid)).Max(gid => userGroupPerms[gid])
            : 1;

        return new ProjectDto
        {
            Id = project.Id,
            Name = project.Name,
            Description = project.Description,
            Color = project.Color,
            CreatedAt = project.CreatedAt,
            TotalTasks = project.Tasks.Count,
            RemainingTasks = project.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done),
            MyPermission = perm
        };
    }

    public async Task<ProjectDto> CreateAsync(CreateProjectDto dto, Guid userId)
    {
        var project = new Project
        {
            Name = dto.Name,
            Description = dto.Description,
            Color = dto.Color,
            OwnerId = userId
        };

        db.Projects.Add(project);
        await db.SaveChangesAsync();

        return new ProjectDto
        {
            Id = project.Id,
            Name = project.Name,
            Description = project.Description,
            Color = project.Color,
            CreatedAt = project.CreatedAt,
            TotalTasks = 0,
            RemainingTasks = 0
        };
    }

    public async Task<ProjectDto?> UpdateAsync(Guid id, UpdateProjectDto dto, Guid userId)
    {
        var project = await db.Projects
            .Include(p => p.Tasks)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null) return null;

        // verifică permisiunea separat (EF Core nu traduce subquery-uri complexe în FirstOrDefaultAsync)
        bool canEdit = project.OwnerId == userId;
        if (!canEdit)
        {
            canEdit = await db.ProjectAssignments
                .AnyAsync(pa => pa.ProjectId == id && pa.UserId == userId && pa.GroupId == null);
        }
        if (!canEdit)
        {
            // grup cu nivel permisiune >= 2
            var userGroupIds = await db.GroupUsers
                .Where(gu => gu.UserId == userId)
                .Select(gu => gu.GroupId)
                .ToListAsync();
            canEdit = await db.ProjectAssignments
                .Where(pa => pa.ProjectId == id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
                .AnyAsync(pa => db.Groups.Any(g => g.Id == (int)pa.GroupId! && g.PermissionLevel >= 2));
        }

        if (!canEdit) return null;

        project.Name = dto.Name;
        project.Description = dto.Description;
        project.Color = dto.Color;

        await db.SaveChangesAsync();

        return new ProjectDto
        {
            Id = project.Id,
            Name = project.Name,
            Description = project.Description,
            Color = project.Color,
            CreatedAt = project.CreatedAt,
            TotalTasks = project.Tasks.Count,
            RemainingTasks = project.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done)
        };
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == id);

        if (project is null) return false;

        // verifică permisiunea separat
        bool canDelete = project.OwnerId == userId;
        if (!canDelete)
        {
            canDelete = await db.ProjectAssignments
                .AnyAsync(pa => pa.ProjectId == id && pa.UserId == userId && pa.GroupId == null);
        }
        if (!canDelete)
        {
            // grup cu nivel permisiune >= 3
            var userGroupIds = await db.GroupUsers
                .Where(gu => gu.UserId == userId)
                .Select(gu => gu.GroupId)
                .ToListAsync();
            canDelete = await db.ProjectAssignments
                .Where(pa => pa.ProjectId == id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
                .AnyAsync(pa => db.Groups.Any(g => g.Id == (int)pa.GroupId! && g.PermissionLevel >= 3));
        }

        if (!canDelete) return false;

        db.Projects.Remove(project);
        await db.SaveChangesAsync();
        return true;
    }
}
