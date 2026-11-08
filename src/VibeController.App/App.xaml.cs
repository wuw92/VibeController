using System.IO;
using System.Text;
using System.Windows;
using VibeController.Infrastructure.Codex;
using VibeController.App.Services;

namespace VibeController.App;

public partial class App : System.Windows.Application
{
    private SingleInstanceGuard? _singleInstance;
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        if (e.Args.Contains(CodexHookInstaller.HookArgument, StringComparer.Ordinal))
        {
            RecordCodexHookEvent();
            Shutdown(0);
            return;
        }

        _singleInstance = new SingleInstanceGuard();
        if (!_singleInstance.IsFirstInstance)
        {
            SingleInstanceGuard.ActivateExistingWindow();
            Shutdown(0);
            return;
        }

        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _singleInstance?.Dispose();
        base.OnExit(e);
    }

    private static void RecordCodexHookEvent()
    {
        try
        {
            var localDataDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "VibeController");
            var store = new CodexActivityStore(Path.Combine(
                localDataDirectory,
                CodexActivityStore.StateFileName));
            using var input = Console.OpenStandardInput();
            using var reader = new StreamReader(
                input,
                new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
                detectEncodingFromByteOrderMarks: true);
            _ = store.TryRecordHookEvent(
                reader.ReadToEnd(),
                DateTimeOffset.UtcNow);
        }
        catch
        {
            // Hook failures must never block or alter the Codex turn.
        }
    }
}
