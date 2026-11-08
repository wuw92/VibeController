using System.Text.Json;
using System.Text.RegularExpressions;
using VibeController.Core.Domain;
using VibeController.Core.Runtime;

namespace VibeController.Infrastructure.Windows;

public interface IDeepSeekShortcutResolver
{
    KeyboardShortcut Resolve(string commandId);
    IReadOnlyList<AgentShortcutOption> GetShortcuts();
}

public sealed class DeepSeekShortcutResolver : IDeepSeekShortcutResolver
{
    private readonly string _keybindingsPath;

    public DeepSeekShortcutResolver() : this(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "@deepseek-ai", "dsh-desktop", "keybindings.json")) { }

    public DeepSeekShortcutResolver(string keybindingsPath) => _keybindingsPath = keybindingsPath;

    public KeyboardShortcut Resolve(string commandId)
    {
        var row = ReadShortcuts().SingleOrDefault(row => row.Definition.CommandId == commandId)
            ?? throw new InvalidOperationException("不支持的 DeepSeek Harness 操作");
        if (row.Message is not null || row.Binding is null)
            throw new InvalidOperationException($"DeepSeek Harness「{row.Definition.Label}」：{row.Message ?? "未绑定快捷键"}");
        return row.Binding;
    }

    public IReadOnlyList<AgentShortcutOption> GetShortcuts() => ReadShortcuts().Select(row =>
        new AgentShortcutOption($"deepseek:{row.Definition.CommandId}", row.Definition.Label,
            row.Binding is null ? null : Format(row.Binding), row.Source, row.Message)).ToArray();

    private IReadOnlyList<ResolvedShortcut> ReadShortcuts()
    {
        Dictionary<string, KeyboardShortcut?> overrides;
        try { overrides = ReadOverrides(); }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException or ArgumentException)
        {
            return DeepSeekShortcutCatalog.Definitions.Select(definition => new ResolvedShortcut(
                definition, null, "error", "快捷键配置不可读，请检查 DSH 设置")).ToArray();
        }
        var rows = DeepSeekShortcutCatalog.Definitions.Select(definition =>
        {
            var modified = !definition.Fixed && overrides.ContainsKey(definition.CommandId);
            var binding = modified ? overrides[definition.CommandId] : definition.Default;
            return new ResolvedShortcut(definition, binding,
                definition.Fixed ? "fixed" : modified ? "custom" : "default",
                binding is null ? "未绑定快捷键，请先在 DSH 中设置" : null);
        }).ToArray();
        return rows.Select(row =>
        {
            if (row.Binding is null || row.Definition.Fixed) return row;
            var conflicts = rows.Where(other => other.Definition.CommandId != row.Definition.CommandId &&
                other.Binding is not null && Overlaps(row.Binding, other.Binding) &&
                (row.Source != "custom" || other.Source == "custom" || other.Definition.Fixed));
            return conflicts.Any() || DeepSeekShortcutCatalog.Reserved.Any(binding => Overlaps(row.Binding, binding))
                ? row with { Message = "快捷键与其他 DSH 操作冲突，请在 DSH 中调整" } : row;
        }).ToArray();
    }

    private Dictionary<string, KeyboardShortcut?> ReadOverrides()
    {
        var result = new Dictionary<string, KeyboardShortcut?>();
        if (!File.Exists(_keybindingsPath)) return result;
        using var document = JsonDocument.Parse(File.ReadAllText(_keybindingsPath));
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("schemaVersion", out var schema) || schema.ValueKind != JsonValueKind.Number ||
            !schema.TryGetInt32(out var version) || version is not (1 or 2) ||
            !root.TryGetProperty("profiles", out var profiles) || profiles.ValueKind != JsonValueKind.Object ||
            root.EnumerateObject().Any(property => property.Name is not ("schemaVersion" or "profiles")))
            throw new JsonException("不支持的 DSH 快捷键配置");
        foreach (var profile in profiles.EnumerateObject())
        {
            if (!Regex.IsMatch(profile.Name, @"^(desktop|web):(macos|windows|linux)$") ||
                profile.Value.ValueKind != JsonValueKind.Object) throw new JsonException("无效的 DSH 配置");
            foreach (var property in profile.Value.EnumerateObject())
            {
                if (!Regex.IsMatch(property.Name, @"^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)+$"))
                    throw new JsonException("无效的 DSH 命令");
                var binding = property.Value.ValueKind == JsonValueKind.Null ? null : ParseBinding(property.Value, version);
                if (profile.Name == "desktop:windows") result[property.Name] = binding;
            }
        }
        return result;
    }

    private static KeyboardShortcut ParseBinding(JsonElement value, int version)
    {
        if (value.ValueKind != JsonValueKind.Object ||
            !value.TryGetProperty("code", out var code) || code.ValueKind != JsonValueKind.String ||
            !value.TryGetProperty("modifiers", out var modifiers) || modifiers.ValueKind != JsonValueKind.Array ||
            value.EnumerateObject().Any(property => property.Name is not ("code" or "secondCode" or "modifiers")))
            throw new JsonException("无效的 DSH 快捷键");
        var key = ParseCode(code.GetString()!);
        var parsedModifiers = modifiers.EnumerateArray().Select(modifier =>
            (modifier.ValueKind == JsonValueKind.String ? modifier.GetString() : null) switch
        {
            "primary" or "control" => KeyModifier.Control,
            "alt" => KeyModifier.Alt,
            "shift" => KeyModifier.Shift,
            "meta" => KeyModifier.Windows,
            _ => throw new JsonException("无效的修饰键"),
        }).Distinct().OrderBy(modifier => modifier switch
        {
            KeyModifier.Control => 0, KeyModifier.Alt => 1, KeyModifier.Shift => 2, _ => 3,
        });
        string? second = null;
        if (value.TryGetProperty("secondCode", out var secondCode))
        {
            if (version != 2 || secondCode.ValueKind != JsonValueKind.String) throw new JsonException("无效的双键快捷键");
            second = ParseCode(secondCode.GetString()!);
            if (second == key) throw new JsonException("双键快捷键需要不同按键");
        }
        return new KeyboardShortcut(key, parsedModifiers) { SecondKey = second };
    }

    private static string ParseCode(string code)
    {
        var key = code switch
        {
            _ when code.Length == 4 && code.StartsWith("Key") && code[3] is >= 'A' and <= 'Z' => code[3..],
            _ when code.Length == 6 && code.StartsWith("Digit") && code[5] is >= '0' and <= '9' => code[5..],
            "Slash" => "/", "Comma" => ",", "Period" => ".", "Backslash" => "\\",
            "Backquote" => "`", "Minus" => "-", "Equal" => "=", "BracketLeft" => "[",
            "BracketRight" => "]", "Semicolon" => ";", "Quote" => "'",
            "Enter" or "Escape" or "Space" or "Tab" or "Backspace" or "Delete" or
            "ArrowUp" or "ArrowDown" or "ArrowLeft" or "ArrowRight" => code,
            _ when code.StartsWith('F') && int.TryParse(code[1..], out var number) && number is >= 1 and <= 24 => code,
            _ => throw new JsonException("不支持的 DSH 按键"),
        };
        return key;
    }

    private static bool Overlaps(KeyboardShortcut left, KeyboardShortcut right)
    {
        if (!left.Modifiers.Order().SequenceEqual(right.Modifiers.Order())) return false;
        var leftKeys = new[] { left.Key, left.SecondKey }.Where(key => key is not null).ToArray();
        var rightKeys = new[] { right.Key, right.SecondKey }.Where(key => key is not null).ToArray();
        return leftKeys.Length == 2 && rightKeys.Length == 2
            ? leftKeys.Order().SequenceEqual(rightKeys.Order()) : leftKeys.Intersect(rightKeys).Any();
    }

    private static string Format(KeyboardShortcut binding) => string.Join("+", binding.Modifiers.Select(modifier => modifier switch
    {
        KeyModifier.Control => "Ctrl", KeyModifier.Alt => "Alt", KeyModifier.Shift => "Shift", _ => "Win",
    }).Append(binding.Key)) + (binding.SecondKey is { } second ? $" + {second}（同时按下）" : "");

    private sealed record ResolvedShortcut(DeepSeekShortcutDefinition Definition, KeyboardShortcut? Binding, string Source, string? Message);
}
