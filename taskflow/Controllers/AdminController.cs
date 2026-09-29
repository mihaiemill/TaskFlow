using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using taskflow.Data;
using taskflow.Models;
using taskflow.Services;

namespace taskflow.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminController(AppDbContext db)
    {
        _db = db;
    }

    private bool IsAdmin()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                 ?? User.FindFirst("email")?.Value
                 ?? User.FindFirst("Email")?.Value;
        return email == AdminAccess.AdminEmail;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value!);

    // GET /api/admin/stats
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        if (!IsAdmin()) return Forbid();

        var usersCount = await _db.Users.CountAsync();
        var projectsCount = await _db.Projects.CountAsync();
        var tasksCount = await _db.Tasks.CountAsync();

        return Ok(new { usersCount, projectsCount, tasksCount });
    }

    // GET /api/admin/users
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        if (!IsAdmin()) return Forbid();

        var users = await _db.Users
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.CreatedAt,
                u.IsActive,
                u.Avatar,
                HasPassword = u.PasswordHash != null,
                IsGoogleLinked = u.GoogleId != null,
                ProjectsCount = u.Projects.Count,
                TasksAssignedCount = u.AssignedTasks.Count,
                IsSelf = u.Email == "admin@admin.com",
            })
            .ToListAsync();

        return Ok(users);
    }

    // POST /api/admin/users — creeaza un utilizator nou (cu parola)
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        if (!IsAdmin()) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.FullName) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { error = "Email, nume și parolă sunt obligatorii." });
        if (dto.Password.Length < 6)
            return BadRequest(new { error = "Parola trebuie să aibă cel puțin 6 caractere." });
        if (!AvatarCatalog.IsValid(dto.Avatar))
            return BadRequest(new { error = "Avatar necunoscut." });

        var email = dto.Email.Trim();
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { error = "Există deja un utilizator cu acest email." });

        var user = new User
        {
            Email = email,
            FullName = dto.FullName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            IsActive = true,
            Avatar = AvatarCatalog.Normalize(dto.Avatar),
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            user.Id,
            user.FullName,
            user.Email,
            user.CreatedAt,
            user.IsActive,
            user.Avatar,
            HasPassword = true,
            IsGoogleLinked = false,
            ProjectsCount = 0,
            TasksAssignedCount = 0,
            IsSelf = false,
        });
    }

    // PATCH /api/admin/users/{id}/status — activ/inactiv; un cont inactiv nu se mai poate autentifica
    [HttpPatch("users/{id}/status")]
    public async Task<IActionResult> UpdateUserStatus(Guid id, [FromBody] UpdateUserStatusDto dto)
    {
        if (!IsAdmin()) return Forbid();

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();
        if (!dto.IsActive && user.Email == AdminAccess.AdminEmail)
            return BadRequest(new { error = "Contul de administrator nu poate fi dezactivat." });

        user.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.IsActive });
    }

    [HttpPatch("users/{id}/avatar")]
    public async Task<IActionResult> UpdateUserAvatar(Guid id, [FromBody] UpdateUserAvatarDto dto)
    {
        if (!IsAdmin()) return Forbid();
        if (!AvatarCatalog.IsValid(dto.Avatar))
            return BadRequest(new { error = "Avatar necunoscut." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        user.Avatar = AvatarCatalog.Normalize(dto.Avatar);
        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.Avatar });
    }

    // PATCH /api/admin/users/{id}/name — adminul redenumeste utilizatorul (independent de parola)
    [HttpPatch("users/{id}/name")]
    public async Task<IActionResult> UpdateUserName(Guid id, [FromBody] UpdateUserNameDto dto)
    {
        if (!IsAdmin()) return Forbid();
        var fullName = dto.FullName?.Trim();
        if (string.IsNullOrEmpty(fullName))
            return BadRequest(new { error = "Numele nu poate fi gol." });
        if (fullName.Length > 100)
            return BadRequest(new { error = "Numele poate avea cel mult 100 de caractere." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        user.FullName = fullName;
        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.FullName });
    }

    // PATCH /api/admin/users/{id}/password — adminul seteaza direct o parola noua
    [HttpPatch("users/{id}/password")]
    public async Task<IActionResult> UpdateUserPassword(Guid id, [FromBody] UpdateUserPasswordDto dto)
    {
        if (!IsAdmin()) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            return BadRequest(new { error = "Parola trebuie să aibă cel puțin 6 caractere." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // DELETE /api/admin/users/{id}?deleteProjects=true|false
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(Guid id, [FromQuery] bool deleteProjects = false)
    {
        if (!IsAdmin()) return Forbid();

        var user = await _db.Users
            .Include(u => u.Projects)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user is null) return NotFound();
        if (user.Email == "admin@admin.com")
            return BadRequest(new { error = "Contul de administrator nu poate fi șters." });

        if (!deleteProjects && user.Projects.Count > 0)
        {
            // transfera proprietatea proiectelor catre admin, ca sa nu se piarda la cascade delete
            foreach (var p in user.Projects)
                p.OwnerId = CurrentUserId;
            await _db.SaveChangesAsync();
        }

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // GET /api/admin/projects
    [HttpGet("projects")]
    public async Task<IActionResult> GetProjects()
    {
        if (!IsAdmin()) return Forbid();

        var projects = await _db.Projects
            .Include(p => p.Owner)
            .OrderBy(p => p.Owner.FullName)
            .ThenBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Color,
                OwnerName = p.Owner.FullName,
                OwnerEmail = p.Owner.Email,
                p.CreatedAt,
                TotalTasks = p.Tasks.Count,
                DoneTasks = p.Tasks.Count(t => t.Status == taskflow.Models.TaskStatus.Done),
            })
            .ToListAsync();

        var projectIds = projects.Select(p => p.Id).ToList();
        var assignments = await _db.ProjectAssignments
            .Where(pa => projectIds.Contains(pa.ProjectId))
            .Include(pa => pa.User)
            .Include(pa => pa.Group)
            .Select(pa => new
            {
                pa.ProjectId,
                Type = pa.UserId != null ? "user" : "group",
                Name = pa.UserId != null ? pa.User!.FullName : pa.Group!.Name,
            })
            .ToListAsync();

        var result = projects.Select(p => new
        {
            p.Id,
            p.Name,
            p.Description,
            p.Color,
            p.OwnerName,
            p.OwnerEmail,
            p.CreatedAt,
            p.TotalTasks,
            p.DoneTasks,
            Assignments = assignments
                .Where(a => a.ProjectId == p.Id)
                .Select(a => new { a.Type, a.Name })
                .ToList(),
        });

        return Ok(result);
    }

    // GET /api/admin/tasks
    [HttpGet("tasks")]
    public async Task<IActionResult> GetTasks()
    {
        if (!IsAdmin()) return Forbid();

        var tasks = await _db.Tasks
            .Include(t => t.Project).ThenInclude(p => p.Owner)
            .Include(t => t.Assignee)
            .OrderBy(t => t.Project.Owner.FullName)
            .ThenBy(t => t.Project.Name)
            .ThenBy(t => t.Title)
            .Select(t => new
            {
                t.Id,
                t.Title,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                ProjectName = t.Project.Name,
                ProjectColor = t.Project.Color,
                OwnerName = t.Project.Owner.FullName,
                AssigneeName = t.Assignee != null ? t.Assignee.FullName : null,
                t.DueDate
            })
            .ToListAsync();

        return Ok(tasks);
    }

    // ── Groups ────────────────────────────────────────────────────────────────

    // GET /api/admin/groups
    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups()
    {
        if (!IsAdmin()) return Forbid();

        var groups = await _db.Groups
            .Include(g => g.GroupUsers)
                .ThenInclude(gu => gu.User)
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                g.Id,
                g.Name,
                g.PermissionLevel,
                Users = g.GroupUsers.Select(gu => new { gu.User.Id, gu.User.FullName, gu.User.Email })
            })
            .ToListAsync();

        return Ok(groups);
    }

    // POST /api/admin/groups
    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateGroupDto dto)
    {
        if (!IsAdmin()) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { error = "Numele grupului este obligatoriu." });

        var group = new Group { Name = dto.Name.Trim() };
        _db.Groups.Add(group);
        await _db.SaveChangesAsync();

        if (dto.UserIds is { Count: > 0 })
        {
            var validIds = await _db.Users
                .Where(u => dto.UserIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            foreach (var uid in validIds)
                _db.GroupUsers.Add(new GroupUser { GroupId = group.Id, UserId = uid });

            await _db.SaveChangesAsync();
        }

        var result = await _db.Groups
            .Include(g => g.GroupUsers).ThenInclude(gu => gu.User)
            .Where(g => g.Id == group.Id)
            .Select(g => new
            {
                g.Id,
                g.Name,
                g.PermissionLevel,
                Users = g.GroupUsers.Select(gu => new { gu.User.Id, gu.User.FullName, gu.User.Email })
            })
            .FirstAsync();

        return Ok(result);
    }

    // PUT /api/admin/groups/{id}  — înlocuiește membrii grupului
    [HttpPut("groups/{id}")]
    public async Task<IActionResult> UpdateGroup(int id, [FromBody] CreateGroupDto dto)
    {
        if (!IsAdmin()) return Forbid();

        var group = await _db.Groups
            .Include(g => g.GroupUsers)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group is null) return NotFound();

        // Șterge toți membrii existenți și adaugă lista nouă (merge-ul se face în frontend)
        _db.GroupUsers.RemoveRange(group.GroupUsers);
        await _db.SaveChangesAsync();

        if (dto.UserIds is { Count: > 0 })
        {
            var validIds = await _db.Users
                .Where(u => dto.UserIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            foreach (var uid in validIds)
                _db.GroupUsers.Add(new GroupUser { GroupId = group.Id, UserId = uid });

            await _db.SaveChangesAsync();
        }

        var result = await _db.Groups
            .Include(g => g.GroupUsers).ThenInclude(gu => gu.User)
            .Where(g => g.Id == group.Id)
            .Select(g => new
            {
                g.Id,
                g.Name,
                g.PermissionLevel,
                Users = g.GroupUsers.Select(gu => new { gu.User.Id, gu.User.FullName, gu.User.Email })
            })
            .FirstAsync();

        return Ok(result);
    }

    // PUT /api/admin/groups/{id}/permissions
    [HttpPut("groups/{id}/permissions")]
    public async Task<IActionResult> UpdatePermissions(int id, [FromBody] UpdatePermissionDto dto)
    {
        if (!IsAdmin()) return Forbid();
        if (dto.PermissionLevel < 1 || dto.PermissionLevel > 3)
            return BadRequest(new { error = "PermissionLevel trebuie să fie 1 (Vizualizare), 2 (Modificare) sau 3 (Ștergere)." });

        var group = await _db.Groups.FindAsync(id);
        if (group is null) return NotFound();

        group.PermissionLevel = dto.PermissionLevel;
        await _db.SaveChangesAsync();

        return Ok(new { group.Id, group.PermissionLevel });
    }

    // DELETE /api/admin/groups/{id}
    [HttpDelete("groups/{id}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        if (!IsAdmin()) return Forbid();

        var group = await _db.Groups
            .Include(g => g.GroupUsers)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group is null) return NotFound();

        _db.GroupUsers.RemoveRange(group.GroupUsers);
        _db.Groups.Remove(group);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ── ProjectAssignments ────────────────────────────────────────────────────

    // GET /api/admin/assignments — toate asignarile, din toate proiectele (pentru dashboard-ul de grupuri)
    [HttpGet("assignments")]
    public async Task<IActionResult> GetAllAssignments()
    {
        if (!IsAdmin()) return Forbid();

        var list = await _db.ProjectAssignments
            .Include(pa => pa.Project)
            .Include(pa => pa.User)
            .Include(pa => pa.Group)
            .OrderBy(pa => pa.Project.Name)
            .Select(pa => new
            {
                pa.Id,
                Type = pa.UserId != null ? "user" : "group",
                Name = pa.UserId != null ? pa.User!.FullName : pa.Group!.Name,
                pa.UserId,
                pa.GroupId,
                ProjectId = pa.ProjectId,
                ProjectName = pa.Project.Name,
                ProjectColor = pa.Project.Color,
            })
            .ToListAsync();

        return Ok(list);
    }

    // GET /api/admin/projects/{id}/assignments
    [HttpGet("projects/{id}/assignments")]
    public async Task<IActionResult> GetAssignments(Guid id)
    {
        if (!IsAdmin()) return Forbid();

        var list = await _db.ProjectAssignments
            .Where(pa => pa.ProjectId == id)
            .Include(pa => pa.User)
            .Include(pa => pa.Group)
            .Select(pa => new AssignmentDto(
                pa.Id,
                pa.UserId != null ? "user" : "group",
                pa.UserId != null ? pa.User!.FullName : pa.Group!.Name,
                pa.UserId,
                pa.GroupId))
            .ToListAsync();

        return Ok(list);
    }

    // POST /api/admin/projects/{id}/assign
    [HttpPost("projects/{id}/assign")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] CreateAssignmentDto dto)
    {
        if (!IsAdmin()) return Forbid();

        if (dto.UserId == null && dto.GroupId == null)
            return BadRequest(new { error = "UserId sau GroupId trebuie specificat." });
        if (dto.UserId != null && dto.GroupId != null)
            return BadRequest(new { error = "Specifica doar UserId SAU GroupId, nu ambele." });

        var exists = await _db.ProjectAssignments.AnyAsync(pa =>
            pa.ProjectId == id &&
            pa.UserId == dto.UserId &&
            pa.GroupId == dto.GroupId);

        if (exists) return Conflict(new { error = "Asignare deja existenta." });

        var assignment = new ProjectAssignment
        {
            ProjectId = id,
            UserId = dto.UserId,
            GroupId = dto.GroupId,
        };
        _db.ProjectAssignments.Add(assignment);
        await _db.SaveChangesAsync();

        var result = await _db.ProjectAssignments
            .Where(pa => pa.Id == assignment.Id)
            .Include(pa => pa.User)
            .Include(pa => pa.Group)
            .Select(pa => new AssignmentDto(
                pa.Id,
                pa.UserId != null ? "user" : "group",
                pa.UserId != null ? pa.User!.FullName : pa.Group!.Name,
                pa.UserId,
                pa.GroupId))
            .FirstAsync();

        return Ok(result);
    }

    // DELETE /api/admin/projects/{id}/assignments/{assignmentId}
    [HttpDelete("projects/{id}/assignments/{assignmentId}")]
    public async Task<IActionResult> RemoveAssignment(Guid id, int assignmentId)
    {
        if (!IsAdmin()) return Forbid();

        var pa = await _db.ProjectAssignments
            .FirstOrDefaultAsync(p => p.Id == assignmentId && p.ProjectId == id);

        if (pa is null) return NotFound();

        _db.ProjectAssignments.Remove(pa);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
public record CreateGroupDto(string Name, List<Guid>? UserIds);
/// <summary>1 = Vizualizare · 2 = Modificare · 3 = Ștergere</summary>
public record UpdatePermissionDto(int PermissionLevel);
public record AssignmentDto(int Id, string Type, string Name, Guid? UserId, int? GroupId);
public record CreateAssignmentDto(Guid? UserId, int? GroupId);
public record CreateUserDto(string Email, string FullName, string Password, string? Avatar = null);
public record UpdateUserStatusDto(bool IsActive);
public record UpdateUserPasswordDto(string NewPassword);
public record UpdateUserNameDto(string? FullName);
public record UpdateUserAvatarDto(string? Avatar);
