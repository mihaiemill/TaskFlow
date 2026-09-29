using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace taskflow.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskImage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageContentType",
                table: "Tasks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageFileName",
                table: "Tasks",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageContentType",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "ImageFileName",
                table: "Tasks");
        }
    }
}
