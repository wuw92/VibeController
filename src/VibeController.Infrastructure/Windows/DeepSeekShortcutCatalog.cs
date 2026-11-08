using VibeController.Core.Domain;

namespace VibeController.Infrastructure.Windows;

internal sealed record DeepSeekShortcutDefinition(string CommandId, string Label, KeyboardShortcut Default, bool Fixed = false);

internal static class DeepSeekShortcutCatalog
{
    public static IReadOnlyList<DeepSeekShortcutDefinition> Definitions { get; } =
    [
        new("fixed.send", "发送消息", new("Enter"), true),
        new("session.new", "新建任务", Ctrl("N")),
        new("session.search", "搜索任务", Ctrl("K")),
        new("settings.open", "打开设置", Ctrl(",")),
        new("shortcuts.open", "打开快捷键速查", Ctrl("/")),
        new("sidebar.left.toggle", "切换左侧栏", Ctrl("B")),
        new("sidebar.right.toggle", "切换右侧栏", Ctrl("B", KeyModifier.Alt)),
        new("workspace.files", "打开工作区文件", Ctrl("P")),
        new("terminal.new", "新建终端", Ctrl("`")),
        new("browser.new", "新建浏览器页面", Ctrl("T")),
        new("workspace.add", "添加工作区", Ctrl("O")),
        new("workspace.openLocal", "在本地应用打开工作区", Ctrl("O", KeyModifier.Alt)),
        new("session.rename", "重命名任务", Ctrl("G", KeyModifier.Alt)),
        new("session.fork", "分叉任务", Ctrl("F", KeyModifier.Alt)),
        new("session.archive", "归档任务", Ctrl("A", KeyModifier.Shift)),
        new("pane.split", "拆分面板", Ctrl("\\")),
        new("pane.fullscreen.toggle", "切换面板全屏", Ctrl("Enter", KeyModifier.Alt)),
        new("page.close", "关闭当前页面", Ctrl("W")),
        new("page.refresh", "刷新当前页面", Ctrl("R")),
    ];

    public static IReadOnlyList<KeyboardShortcut> Reserved { get; } =
    [
        new("Enter"), new("Enter", [KeyModifier.Shift]), Ctrl("Enter"),
        new("Enter", [KeyModifier.Windows]), new("Escape"), new("/"),
        new("2", [KeyModifier.Shift]), Ctrl("="), Ctrl("=", KeyModifier.Shift), Ctrl("-"),
        new("ArrowUp"), new("ArrowDown"),
    ];

    private static KeyboardShortcut Ctrl(string key, params KeyModifier[] modifiers) =>
        new(key, new[] { KeyModifier.Control }.Concat(modifiers));
}
