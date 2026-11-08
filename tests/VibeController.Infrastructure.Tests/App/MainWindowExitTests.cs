using System.Reflection;
using System.Windows;
using System.Windows.Threading;
using VibeController.App;
using VibeController.App.Services;

namespace VibeController.Infrastructure.Tests.App;

public sealed class MainWindowExitTests
{
    [Fact]
    public void TrayExit_ClosesTheWindowEvenWhenRuntimeCleanupFails()
    {
        Exception? failure = null;
        var closed = false;
        var timedOut = false;
        var thread = new Thread(() =>
        {
            try
            {
                var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
                var window = new MainWindow { Left = -5000, Top = -5000, ShowInTaskbar = false };
                var loaded = typeof(MainWindow).GetMethod("OnLoaded", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.DeclaredOnly)!;
                window.Loaded -= (RoutedEventHandler)loaded.CreateDelegate(typeof(RoutedEventHandler), window);
                window.Closed += (_, _) => closed = true;
                var runtime = (ControllerRuntimeService)typeof(MainWindow)
                    .GetField("_runtime", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(window)!;
                var timeout = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
                timeout.Tick += (_, _) => { timedOut = true; timeout.Stop(); app.Shutdown(); };
                app.DispatcherUnhandledException += (_, e) => { failure = e.Exception; e.Handled = true; };
                app.Dispatcher.BeginInvoke(new Action(async () =>
                {
                    await runtime.DisposeAsync();
                    window.Show();
                    timeout.Start();
                    typeof(MainWindow).GetMethod("ExitApplication", BindingFlags.Instance | BindingFlags.NonPublic)!
                        .Invoke(window, null);
                }));
                app.Run();
                timeout.Stop();
            }
            catch (Exception exception) { failure = exception; }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        Assert.True(thread.Join(TimeSpan.FromSeconds(10)));
        Assert.Null(failure);
        Assert.False(timedOut);
        Assert.True(closed);
    }
}
