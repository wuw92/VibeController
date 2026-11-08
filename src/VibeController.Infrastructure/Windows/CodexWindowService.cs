using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using VibeController.Core.Domain;
using VibeController.Core.Execution;

namespace VibeController.Infrastructure.Windows;

public static class CodexWindowMatcher
{
    public static bool IsCodexWindow(
        string processName,
        string? executablePath,
        string windowTitle)
    {
        if (!processName.Equals("ChatGPT", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var isCodexPackage = executablePath?.Contains(
            "OpenAI.Codex",
            StringComparison.OrdinalIgnoreCase) == true;
        var isChatGptDesktopWindow = windowTitle.Equals(
            "ChatGPT",
            StringComparison.OrdinalIgnoreCase);

        return isCodexPackage || isChatGptDesktopWindow;
    }
}

public sealed class CodexWindowService : ICodexWindowService
{
    private const int ShowRestore = 9;

    public bool IsCodexForeground() => GetForegroundAgent() == AgentTarget.Codex;

    public AgentTarget? GetForegroundAgent()
    {
        var window = GetForegroundWindow();
        if (window == IntPtr.Zero)
        {
            return null;
        }

        GetWindowThreadProcessId(window, out var processId);
        if (processId == 0)
        {
            return null;
        }

        try
        {
            using var process = Process.GetProcessById((int)processId);
            var title = new StringBuilder(512);
            GetWindowText(window, title, title.Capacity);
            return AgentWindowMatcher.Match(process.ProcessName, GetExecutablePath(process), title.ToString());
        }
        catch (ArgumentException)
        {
            return null;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    public bool TryActivateCodex()
    {
        foreach (var process in Process.GetProcessesByName("ChatGPT"))
        {
            using (process)
            {
                if (process.MainWindowHandle == IntPtr.Zero || !Matches(process))
                {
                    continue;
                }

                ShowWindow(process.MainWindowHandle, ShowRestore);
                return SetForegroundWindow(process.MainWindowHandle);
            }
        }

        return false;
    }

    public bool TryActivateDeepSeekHarness()
    {
        foreach (var process in Process.GetProcessesByName("DeepSeek Harness"))
        {
            using (process)
            {
                if (process.MainWindowHandle == IntPtr.Zero) continue;
                ShowWindow(process.MainWindowHandle, ShowRestore);
                return SetForegroundWindow(process.MainWindowHandle);
            }
        }
        return false;
    }

    private static bool Matches(Process process)
        => CodexWindowMatcher.IsCodexWindow(
            process.ProcessName, GetExecutablePath(process), process.MainWindowTitle);

    private static string? GetExecutablePath(Process process)
    {
        string? executablePath = null;
        try
        {
            executablePath = process.MainModule?.FileName;
        }
        catch (System.ComponentModel.Win32Exception)
        {
        }
        catch (InvalidOperationException)
        {
        }

        return executablePath;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(IntPtr window, int command);
}

public static class AgentWindowMatcher
{
    public static AgentTarget? Match(string processName, string? executablePath, string windowTitle)
    {
        if (processName.Equals("DeepSeek Harness", StringComparison.OrdinalIgnoreCase))
        {
            return AgentTarget.DeepSeekHarness;
        }
        return CodexWindowMatcher.IsCodexWindow(processName, executablePath, windowTitle)
            ? AgentTarget.Codex : null;
    }
}
