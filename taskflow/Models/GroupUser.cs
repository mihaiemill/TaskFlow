using System;
using System.Text.RegularExpressions;

namespace taskflow.Models;

public class GroupUser
{
    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
}
