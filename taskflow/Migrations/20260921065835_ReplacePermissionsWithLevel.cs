using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace taskflow.Migrations
{
    /// <inheritdoc />
    public partial class ReplacePermissionsWithLevel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanDelete",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "CanModify",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "CanSave",
                table: "Groups");

            migrationBuilder.AddColumn<int>(
                name: "PermissionLevel",
                table: "Groups",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PermissionLevel",
                table: "Groups");

            migrationBuilder.AddColumn<bool>(
                name: "CanDelete",
                table: "Groups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanModify",
                table: "Groups",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanSave",
                table: "Groups",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
