using Microsoft.EntityFrameworkCore;
using taskflow.Models;

namespace taskflow.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<TaskTag> TaskTags => Set<TaskTag>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<TaskImage> TaskImages => Set<TaskImage>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupUser> GroupUsers => Set<GroupUser>();
    public DbSet<ProjectAssignment> ProjectAssignments => Set<ProjectAssignment>();  

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<ProjectAssignment>(e =>
        {
            e.HasOne(pa => pa.Project)
             .WithMany()
             .HasForeignKey(pa => pa.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(pa => pa.User)
             .WithMany()
             .HasForeignKey(pa => pa.UserId)
             .OnDelete(DeleteBehavior.Cascade)
             .IsRequired(false);

            e.HasOne(pa => pa.Group)
             .WithMany()
             .HasForeignKey(pa => pa.GroupId)
             .OnDelete(DeleteBehavior.Cascade)
             .IsRequired(false);
        });

        mb.Entity<TaskTag>()
            .HasKey(tt => new { tt.TaskItemId, tt.TagId });

        mb.Entity<User>()
            .HasIndex(u => u.Email).IsUnique();

        mb.Entity<User>()
            .Property(u => u.Avatar).HasMaxLength(AvatarCatalog.MaxKeyLength);

        mb.Entity<Tag>()
            .HasIndex(t => t.Name).IsUnique();

        mb.Entity<TaskItem>()
            .Property(t => t.Status)
            .HasConversion<string>();

        mb.Entity<TaskItem>()
            .Property(t => t.Priority)
            .HasConversion<string>();

        mb.Entity<TaskItem>()
            .HasOne(t => t.Assignee)
            .WithMany(u => u.AssignedTasks)
            .HasForeignKey(t => t.AssigneeId)
            .OnDelete(DeleteBehavior.SetNull);

        mb.Entity<Comment>()
            .HasOne(c => c.Author)
            .WithMany(u => u.Comments)
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<TaskTag>()
            .HasOne(tt => tt.TaskItem)
            .WithMany(t => t.TaskTags)
            .HasForeignKey(tt => tt.TaskItemId)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<TaskTag>()
            .HasOne(tt => tt.Tag)
            .WithMany(t => t.TaskTags)
            .HasForeignKey(tt => tt.TagId)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<TaskItem>()
            .HasOne(t => t.Project)
            .WithMany(p => p.Tasks)
            .HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<Comment>()
            .HasOne(c => c.TaskItem)
            .WithMany(t => t.Comments)
            .HasForeignKey(c => c.TaskItemId)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<TaskImage>()
            .HasOne(i => i.TaskItem)
            .WithMany(t => t.Images)
            .HasForeignKey(i => i.TaskItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Groups ────────────────────────────────────────────────────────────
        mb.Entity<GroupUser>()
            .HasKey(gu => new { gu.GroupId, gu.UserId });

        mb.Entity<GroupUser>()
            .HasOne(gu => gu.Group)
            .WithMany(g => g.GroupUsers)
            .HasForeignKey(gu => gu.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<GroupUser>()
            .HasOne(gu => gu.User)
            .WithMany()
            .HasForeignKey(gu => gu.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
