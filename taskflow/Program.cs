using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using taskflow.Data;
using taskflow.Services;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Controllers + Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Introdu token-ul JWT"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// PostgreSQL + EF Core
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// JWT
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.MapInboundClaims = false;
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
        opt.Events = new JwtBearerEvents
        {
            // La fiecare request: un token valid nu mai ajunge dacă între timp contul a fost
            // dezactivat sau șters — sesiunile deschise se închid imediat, nu la expirarea token-ului.
            OnTokenValidated = async ctx =>
            {
                var sub = ctx.Principal?.FindFirst("sub")?.Value;
                if (!Guid.TryParse(sub, out var userId)) { ctx.Fail("Token invalid."); return; }

                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var isActive = await AccountStatus.IsActiveAsync(db, userId);

                if (isActive is null) { ctx.Fail("Utilizator inexistent."); return; }
                if (isActive == false)
                {
                    ctx.HttpContext.Items["account_inactive"] = true;
                    ctx.Fail("Cont inactiv.");
                }
            },
            // 401 cu cod dedicat, ca frontend-ul să poată afișa alerta „Cont inactiv”
            OnChallenge = async ctx =>
            {
                if (!ctx.HttpContext.Items.ContainsKey("account_inactive")) return;
                ctx.HandleResponse();
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsJsonAsync(new { code = "account_inactive", error = "Contul este inactiv." });
            },
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<ITagService, TagService>();

// CORS pentru React
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(
            builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()!
                .Append("http://localhost:3000").ToArray()
        )
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

// Migrări automate la startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Contul de admin nu se poate crea prin /register — îl creăm aici, o singură dată, pe o bază nouă
    var seed = await AdminAccess.EnsureAdminAsync(db, builder.Configuration["Admin:InitialPassword"]);
    var startupLog = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    if (seed == AdminAccess.SeedResult.Created)
        startupLog.LogInformation("Contul de admin {Email} a fost creat.", AdminAccess.AdminEmail);
    else if (seed == AdminAccess.SeedResult.MissingPassword)
        startupLog.LogWarning("Nu există cont de admin și Admin:InitialPassword nu e setat (minim 6 caractere) — adminul nu a fost creat.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();