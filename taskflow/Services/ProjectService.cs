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

public class ProjectService(AppDbContext db, IWebHostEnvironment env) : IProjectService
{
    public async Task<List<ProjectDto>> GetAllAsync(Guid userId)
    {
        // grupurile utilizatorului + nivelul de permisiune al fiecăruia
        var userGroupPerms = await db.GroupUsers
            .Where(gu => gu.UserId == userId)
            .Select(gu => new { gu.GroupId, gu.Group.PermissionLevel })
            .ToDictionaryAsync(gu => gu.GroupId, gu => gu.PermissionLevel);

        var userGroupIds = userGroupPerms.Keys.ToList();

        var projectsList = await db.Projects
            .Where(p =>
                p.OwnerId == userId
                || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.UserId == userId)
                || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!)))
            .Select(p => new ProjectRow(
                p.Id, p.Name, p.Description, p.Color, p.CreatedAt, p.OwnerId,
                p.Tasks.Count,
                p.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done)))
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
                return ToDto(p, 3);

            // asignat direct pe user (nu prin grup) → drepturi depline
            if (directAssignmentProjectIds.Contains(p.Id))
                return ToDto(p, 3);

            var perms = groupAssignments
                .Where(ga => ga.ProjectId == p.Id && userGroupPerms.ContainsKey(ga.GroupId))
                .Select(ga => userGroupPerms[ga.GroupId])
                .ToList();
            int perm = perms.Any() ? perms.Max() : 1;

            return ToDto(p, perm);
        }).ToList();
    }

    private record ProjectRow(Guid Id, string Name, string? Description, string Color, DateTime CreatedAt, Guid OwnerId, int TotalTasks, int RemainingTasks);

    private static ProjectDto ToDto(ProjectRow p, int permission) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        Color = p.Color,
        CreatedAt = p.CreatedAt,
        TotalTasks = p.TotalTasks,
        RemainingTasks = p.RemainingTasks,
        MyPermission = permission
    };

    public async Task<ProjectDto?> GetByIdAsync(Guid id, Guid userId)
    {
        var userGroupPerms = await db.GroupUsers
            .Where(gu => gu.UserId == userId)
            .Select(gu => new { gu.GroupId, gu.Group.PermissionLevel })
            .ToDictionaryAsync(gu => gu.GroupId, gu => gu.PermissionLevel);

        var userGroupIds = userGroupPerms.Keys.ToList();
        var isAdmin = await AdminAccess.IsAdminAsync(db, userId);

        var project = await db.Projects
            .Where(p =>
                p.Id == id
                && (
                    isAdmin
                    || p.OwnerId == userId
                    || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.UserId == userId)
                    || db.ProjectAssignments.Any(pa => pa.ProjectId == p.Id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
                ))
            .Select(p => new ProjectRow(
                p.Id, p.Name, p.Description, p.Color, p.CreatedAt, p.OwnerId,
                p.Tasks.Count,
                p.Tasks.Count(t => t.Status != taskflow.Models.TaskStatus.Done)))
            .FirstOrDefaultAsync();

        if (project is null) return null;

        // creatorul proiectului și adminul au întotdeauna drepturi depline
        if (project.OwnerId == userId || isAdmin)
            return ToDto(project, 3);

        // asignat direct pe user (nu prin grup) → drepturi depline
        var hasDirectAssignment = await db.ProjectAssignments
            .AnyAsync(pa => pa.ProjectId == id && pa.UserId == userId && pa.GroupId == null);

        if (hasDirectAssignment)
            return ToDto(project, 3);

        var groupIds = await db.ProjectAssignments
            .Where(pa => pa.ProjectId == id && pa.GroupId != null && userGroupIds.Contains((int)pa.GroupId!))
            .Select(pa => (int)pa.GroupId!)
            .ToListAsync();

        int perm = groupIds.Any(gid => userGroupPerms.ContainsKey(gid))
            ? groupIds.Where(gid => userGroupPerms.ContainsKey(gid)).Max(gid => userGroupPerms[gid])
            : 1;

        return ToDto(project, perm);
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
        bool canEdit = project.OwnerId == userId || await AdminAccess.IsAdminAsync(db, userId);
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

        bool canDelete = project.OwnerId == userId || await AdminAccess.IsAdminAsync(db, userId);
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

        // Imaginile taskurilor se șterg din DB prin cascade, dar fișierele de pe disc trebuie șterse manual
        var imageFileNames = await db.TaskImages
            .Where(i => i.TaskItem.ProjectId == id)
            .Select(i => i.FileName)
            .ToListAsync();

        db.Projects.Remove(project);
        await db.SaveChangesAsync();

        var uploadsDir = Path.Combine(env.ContentRootPath, "uploads");
        foreach (var fileName in imageFileNames)
        {
            var path = Path.Combine(uploadsDir, fileName);
            if (File.Exists(path)) File.Delete(path);
        }
        return true;
    }
}
