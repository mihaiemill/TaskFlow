using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace taskflow.Controllers;

// Serviciile aruncă UnauthorizedAccessException când utilizatorul are acces la proiect,
// dar nivelul lui (ex. doar Vizualizare) nu permite acțiunea → răspundem cu 403.
public class ForbidOnUnauthorizedAccessAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        if (context.Exception is not UnauthorizedAccessException) return;

        context.Result = new ObjectResult(new { message = "Nu ai permisiunea necesară pe acest proiect." })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
        context.ExceptionHandled = true;
    }
}
