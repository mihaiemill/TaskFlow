namespace taskflow.Models;

public static class AvatarCatalog
{
    public const int MaxKeyLength = 32;

    public static readonly IReadOnlySet<string> Keys = new HashSet<string>
    {
        "fox", "panda", "octopus", "owl", "cat",
        "dog", "lion", "tiger", "koala", "frog",
        "penguin", "unicorn", "bear", "rabbit", "monkey",
        "whale", "turtle", "bee", "butterfly", "dragon",
    };

    public static bool IsValid(string? key) => string.IsNullOrEmpty(key) || Keys.Contains(key);

    public static string? Normalize(string? key) => string.IsNullOrEmpty(key) ? null : key;
}
