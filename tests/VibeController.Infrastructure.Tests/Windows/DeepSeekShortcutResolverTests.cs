using System.Text.Json;
using VibeController.Core.Domain;
using VibeController.Infrastructure.Windows;

namespace VibeController.Infrastructure.Tests.Windows;

public sealed class DeepSeekShortcutResolverTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "VibeController.Tests", Guid.NewGuid().ToString("N"));
    private string PathName => Path.Combine(_directory, "keybindings.json");

    [Fact]
    public void Resolve_UsesVerifiedWindowsDefaultsAndFixedSend()
    {
        var resolver = new DeepSeekShortcutResolver(PathName);
        Assert.Equal("K", resolver.Resolve("session.search").Key);
        Assert.Equal([KeyModifier.Control], resolver.Resolve("session.search").Modifiers);
        Assert.Equal("Enter", resolver.Resolve("fixed.send").Key);
        Assert.Contains(resolver.GetShortcuts(), option => option.Value == "deepseek:terminal.new" && option.Shortcut == "Ctrl+`" && option.Source == "default");
    }

    [Fact]
    public void Resolve_ReReadsChangesAndSelectsOnlyDesktopWindowsProfile()
    {
        Write(new { code = "KeyJ", modifiers = new[] { "primary", "alt", "shift", "meta" } });
        var resolver = new DeepSeekShortcutResolver(PathName);
        var shortcut = resolver.Resolve("session.search");
        Assert.Equal("J", shortcut.Key);
        Assert.Equal([KeyModifier.Control, KeyModifier.Alt, KeyModifier.Shift, KeyModifier.Windows], shortcut.Modifiers);
        Assert.Equal("custom", resolver.GetShortcuts().Single(option => option.Value == "deepseek:session.search").Source);
        Write(new { code = "F7", modifiers = Array.Empty<string>() });
        Assert.Equal("F7", resolver.Resolve("session.search").Key);
    }

    [Fact]
    public void Resolve_NullMeansUnboundAndFixedCommandsIgnoreOverrides()
    {
        Write(null);
        var resolver = new DeepSeekShortcutResolver(PathName);
        Assert.Throws<InvalidOperationException>(() => resolver.Resolve("session.search"));
        Assert.Null(resolver.GetShortcuts().Single(option => option.Value == "deepseek:session.search").Shortcut);
        Assert.Equal("Enter", resolver.Resolve("fixed.send").Key);
    }

    [Fact]
    public void Resolve_CustomBindingDisplacesDefaultAndConflictingCustomBindingsAreUnavailable()
    {
        Write(new { code = "KeyN", modifiers = new[] { "control" } });
        var resolver = new DeepSeekShortcutResolver(PathName);
        Assert.Equal("N", resolver.Resolve("session.search").Key);
        Assert.Throws<InvalidOperationException>(() => resolver.Resolve("session.new"));
        Write(new { code = "KeyN", modifiers = new[] { "control" } },
            new { code = "KeyN", modifiers = new[] { "primary" } });
        Assert.Throws<InvalidOperationException>(() => resolver.Resolve("session.search"));
        Assert.Throws<InvalidOperationException>(() => resolver.Resolve("session.new"));
    }

    [Fact]
    public void Resolve_RejectsConflictWithFixedInputs()
    {
        Write(new { code = "Enter", modifiers = Array.Empty<string>() });
        Assert.Throws<InvalidOperationException>(() => new DeepSeekShortcutResolver(PathName).Resolve("session.search"));
    }

    [Fact]
    public void Resolve_VersionTwoPreservesSimultaneousKeys()
    {
        Write(new { code = "KeyF", secondCode = "KeyG", modifiers = new[] { "control" } }, version: 2);
        var resolver = new DeepSeekShortcutResolver(PathName);
        var shortcut = resolver.Resolve("session.search");
        Assert.Equal("F", shortcut.Key);
        Assert.Equal("G", shortcut.SecondKey);
        Assert.Contains("同时按下", resolver.GetShortcuts().Single(option => option.Value == "deepseek:session.search").Shortcut);
    }

    [Theory]
    [InlineData("{broken")]
    [InlineData("{\"schemaVersion\":3,\"profiles\":{}}")]
    [InlineData("{\"schemaVersion\":\"1\",\"profiles\":{}}")]
    [InlineData("{\"schemaVersion\":1,\"profiles\":{\"desktop:windows\":{\"session.search\":{\"code\":\"KeyJ\",\"modifiers\":[7]}}}}")]
    public void Resolve_UnreadablePreferencesExposeErrorAndDoNotInjectDefaults(string json)
    {
        Directory.CreateDirectory(_directory);
        File.WriteAllText(PathName, json);
        var resolver = new DeepSeekShortcutResolver(PathName);
        Assert.Throws<InvalidOperationException>(() => resolver.Resolve("session.search"));
        Assert.All(resolver.GetShortcuts(), option => Assert.Equal("error", option.Source));
    }

    private void Write(object? searchBinding, object? newBinding = null, int version = 1)
    {
        Directory.CreateDirectory(_directory);
        var windows = new Dictionary<string, object?> { ["session.search"] = searchBinding, ["fixed.send"] = null };
        if (newBinding is not null) windows["session.new"] = newBinding;
        File.WriteAllText(PathName, JsonSerializer.Serialize(new
        {
            schemaVersion = version,
            profiles = new Dictionary<string, object>
            {
                ["desktop:windows"] = windows,
                ["web:windows"] = new Dictionary<string, object> { ["session.search"] = new { code = "KeyL", modifiers = new[] { "primary" } } },
            },
        }));
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory)) Directory.Delete(_directory, recursive: true);
    }
}
