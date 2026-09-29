using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace taskflow.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TaskImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    ContentType = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TaskItemId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskImages_Tasks_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "Tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskImages_TaskItemId",
                table: "TaskImages",
                column: "TaskItemId");

            // Mută imaginea unică (din migrarea AddTaskImage) în tabelul nou, înainte de a șterge coloanele
            migrationBuilder.Sql(@"
                INSERT INTO ""TaskImages"" (""Id"", ""FileName"", ""ContentType"", ""CreatedAt"", ""TaskItemId"")
                SELECT gen_random_uuid(), ""ImageFileName"", COALESCE(""ImageContentType"", 'application/octet-stream'), NOW(), ""Id""
                FROM ""Tasks""
                WHERE ""ImageFileName"" IS NOT NULL;");

            migrationBuilder.DropColumn(
                name: "ImageContentType",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "ImageFileName",
                table: "Tasks");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskImages");

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
    }
}
