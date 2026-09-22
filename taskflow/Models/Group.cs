using System.Collections.Generic;

namespace taskflow.Models;

public class Group
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int PermissionLevel { get; set; } = 1;

    public ICollection<GroupUser> GroupUsers { get; set; } = new List<GroupUser>();
}