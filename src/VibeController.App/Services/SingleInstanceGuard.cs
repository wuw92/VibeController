using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace VibeController.App.Services;

public sealed class SingleInstanceGuard : IDisposable
{
    private readonly Mutex _mutex;
    private bool _disposed;
    public bool IsFirstInstance { get; }

    public SingleInstanceGuard(string name = @"Local\VibeController.App.SingleInstance")
    {
        _mutex = new Mutex(false, name);
        try { IsFirstInstance = _mutex.WaitOne(0); }
        catch (AbandonedMutexException) { IsFirstInstance = true; }
    }

    public static void ActivateExistingWindow()
    {
        using var current = Process.GetCurrentProcess();
        EnumWindows((window, _) =>
        {
            GetWindowThreadProcessId(window, out var processId);
            if (processId == current.Id || processId == 0) return true;
            var title = new StringBuilder(128);
            GetWindowText(window, title, title.Capacity);
            if (title.ToString() != "VibeController") return true;
            try
            {
                using var process = Process.GetProcessById((int)processId);
                if (process.ProcessName != current.ProcessName || process.SessionId != current.SessionId) return true;
                ShowWindow(window, 9);
                SetForegroundWindow(window);
                return false;
            }
            catch (ArgumentException) { return true; }
            catch (InvalidOperationException) { return true; }
        }, IntPtr.Zero);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        if (IsFirstInstance) _mutex.ReleaseMutex();
        _mutex.Dispose();
    }

    private delegate bool WindowCallback(IntPtr window, IntPtr state);
    [DllImport("user32.dll")] private static extern bool EnumWindows(WindowCallback callback, IntPtr state);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
}
