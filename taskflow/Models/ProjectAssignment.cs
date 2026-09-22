using System;
using System.Text.RegularExpressions;

namespace taskflow.Models;

public class ProjectAssignment
{
	public int Id { get; set; }
	public Guid ProjectId { get; set; }
	public Project Project { get; set; } = null!;

	public Guid? UserId { get; set; }
	public User? User { get; set; }

	public int? GroupId { get; set; }
	public Group? Group { get; set; }
}