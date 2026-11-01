using System.Reflection;
using System.Text.Json;
using VibeController.App.Services;
using VibeController.Core.Devices;
using VibeController.Core.Domain;
using VibeController.Core.Execution;
using VibeController.Core.Mapping;
using VibeController.Core.Runtime;
using VibeController.Infrastructure.Settings;

namespace VibeController.Infrastructure.Tests.App;

public sealed class ControllerRuntimeServiceConfigurationTests
{
    [Fact]
    public async Task MappingSaveAndReset_KeepRuntimeAndAdapterAndPersistAuthoritativeProfile()
    {
        var store = new RecordingSettingsStore();
        var adapter = new DisposableAdapter();
        var executor = new RecordingExecutor();
        var runtime = new ControllerRuntime(
            adapter,
            new ActionDispatcher(new CodexForeground(), executor),
            store.Settings.Profile);
        await using var service = new ControllerRuntimeService(store);
        SetField(service, "_runtime", runtime);

        await service.HandleCommandAsync(Command("updateMapping", new
        {
            x = "shortcut:Ctrl+K",
            leftShoulder = "nextTab",
        }));

        Assert.Same(runtime, GetField<ControllerRuntime>(service, "_runtime"));
        Assert.False(adapter.Disposed);
        Assert.Equal("shortcut:Ctrl+K", BuildConfiguration(service).Mappings["x"]);
        Assert.Equal("nextTab", BuildConfiguration(service).Mappings["leftShoulder"]);
        var options = new RuntimeOptions(0, true, false, 0.12f,
            new ActionExecutionOptions(true, new KeyboardShortcut("F12"), 1, 1));
        await runtime.TickAsync(options, DateTimeOffset.UnixEpoch);
        Assert.Equal("K", Assert.Single(executor.Invocations).Action.Shortcut!.Key);

        await service.HandleCommandAsync(Command("resetDefaults", new { }));

        Assert.Same(runtime, GetField<ControllerRuntime>(service, "_runtime"));
        Assert.False(adapter.Disposed);
        Assert.Equal(2, store.SaveCount);
        var defaults = DefaultProfileFactory.Create().Mappings.ToDictionary(
            pair => pair.Key, pair => MappedActionCodec.Format(pair.Value));
        Assert.Equal(defaults, store.Settings.Profile.Mappings.ToDictionary(
            pair => pair.Key, pair => MappedActionCodec.Format(pair.Value)));
        Assert.Equal("dictation", BuildConfiguration(service).Mappings["x"]);
        // The held press is not re-emitted by a profile swap.
        var next = await runtime.TickAsync(options, DateTimeOffset.UnixEpoch.AddMilliseconds(16));
        Assert.Empty(next.InputEvents);
    }

    [Fact]
    public async Task ConfigurationFormatting_IsCachedUntilProfileChanges()
    {
        await using var service = new ControllerRuntimeService(new RecordingSettingsStore());
        var first = BuildConfiguration(service);
        var second = BuildConfiguration(service);
        Assert.Same(first.Mappings, second.Mappings);

        await service.HandleCommandAsync(Command("updateMapping", new { a = "none" }));
        var changed = BuildConfiguration(service);
        Assert.NotSame(first.Mappings, changed.Mappings);
        Assert.Equal("none", changed.Mappings["a"]);
        Assert.Same(changed.Mappings, BuildConfiguration(service).Mappings);
    }

    [Fact]
    public async Task ResetAlreadyDefaultProfile_StillAcknowledgesWithAuthoritativeConfiguration()
    {
        await using var service = new ControllerRuntimeService(new RecordingSettingsStore());
        var messages = new List<string>();
        service.StateJsonReady += messages.Add;
        var now = DateTimeOffset.UnixEpoch;
        PublishTick(service, now, 1, connectionChanged: true);

        await service.HandleCommandAsync(Command("resetDefaults", new { }));
        PublishTick(service, now.AddMilliseconds(250), 1);

        Assert.Equal(2, messages.Count);
        Assert.Equal(messages[0], messages[1]);
    }

    [Fact]
    public async Task RuntimePublication_OmitsHotPathConfigurationAndEventuallyFlushesDirtyConfiguration()
    {
        await using var service = new ControllerRuntimeService(new RecordingSettingsStore());
        var messages = new List<string>();
        service.StateJsonReady += messages.Add;
        var now = DateTimeOffset.UnixEpoch;
        PublishTick(service, now, 1, connectionChanged: true);
        await service.HandleCommandAsync(Command("updateMapping", new { x = "none" }));
        PublishTick(service, now.AddMilliseconds(16), 2, hasInput: true);
        Assert.Equal(2, messages.Count);
        using (var initial = JsonDocument.Parse(messages[0]))
        {
            Assert.True(initial.RootElement.GetProperty("payload").TryGetProperty("configuration", out _));
        }
        using (var hot = JsonDocument.Parse(messages[1]))
        {
            Assert.False(hot.RootElement.GetProperty("payload").TryGetProperty("configuration", out _));
        }
        // A pending configuration change must flush even when input has stopped.
        PublishTick(service, now.AddMilliseconds(250), 2);
        Assert.Equal(3, messages.Count);
        using var configuration = JsonDocument.Parse(messages[2]);
        Assert.Equal("none", configuration.RootElement.GetProperty("payload")
            .GetProperty("configuration").GetProperty("mappings").GetProperty("x").GetString());
    }

    [Fact]
    public async Task RequestState_ReplaysFullConfigurationAfterAnInputOnlyPayload()
    {
        await using var service = new ControllerRuntimeService(new RecordingSettingsStore());
        var payload = new RuntimeStatePayload(
            "connected", 0, true, false, 55,
            new Dictionary<string, float> { ["x"] = 1 }, null);
        SetField(service, "_lastPayload", payload);
        SetField(service, "_lastConfiguration", BuildConfiguration(service));

        AssertFullReplay(service.CurrentStateJson!);
        await service.HandleCommandAsync(Command("updateMapping", new { x = "none" }));
        string? replay = null;
        service.StateJsonReady += json => replay = json;
        await service.HandleCommandAsync(Command("requestState", new { }));
        AssertFullReplay(replay!);
        using var document = JsonDocument.Parse(replay!);
        Assert.Equal("none", document.RootElement.GetProperty("payload")
            .GetProperty("configuration").GetProperty("mappings").GetProperty("x").GetString());
    }

    private static void AssertFullReplay(string json)
    {
        using var document = JsonDocument.Parse(json);
        var payload = document.RootElement.GetProperty("payload");
        Assert.Equal(55u, payload.GetProperty("packetNumber").GetUInt32());
        Assert.True(payload.GetProperty("configuration").GetProperty("mappings")
            .EnumerateObject().Any());
    }

    private static string Command(string type, object payload) =>
        JsonSerializer.Serialize(new { version = 1, type, payload });

    private static void PublishTick(ControllerRuntimeService service, DateTimeOffset timestamp,
        uint packet, bool connectionChanged = false, bool hasInput = false)
    {
        var state = new RuntimeState(ControllerConnectionState.Connected, 0, true, false,
            packet, ControllerSnapshot.Empty);
        var result = new RuntimeTickResult(state, connectionChanged,
            hasInput ? [new InputEvent(ControllerControl.X, InputEdge.Pressed, 1, timestamp)] : [],
            []);
        service.GetType().GetMethod("PublishRuntimeState",
            BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(service,
                [result, timestamp, false]);
    }

    private static RuntimeConfigurationPayload BuildConfiguration(ControllerRuntimeService service) =>
        (RuntimeConfigurationPayload)service.GetType().GetMethod("BuildConfiguration",
            BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(service, null)!;

    private static void SetField(ControllerRuntimeService service, string name, object value) =>
        service.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!
            .SetValue(service, value);

    private static T GetField<T>(ControllerRuntimeService service, string name) =>
        (T)service.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!
            .GetValue(service)!;

    private sealed class RecordingSettingsStore : ISettingsStore
    {
        public AppSettings Settings { get; private set; } = AppSettings.CreateDefault();
        public int SaveCount { get; private set; }
        public Task<AppSettings> LoadAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(Settings);
        public Task SaveAsync(AppSettings settings, CancellationToken cancellationToken = default)
        {
            Settings = settings;
            SaveCount++;
            return Task.CompletedTask;
        }
    }

    private sealed class DisposableAdapter : IControllerAdapter, IDisposable
    {
        public bool Disposed { get; private set; }
        public ControllerReadResult Read(int controllerIndex, ControllerSnapshot previous, float deadZone) =>
            new(true, controllerIndex, 1, ControllerSnapshot.Empty.With(ControllerControl.X, 1));
        public void Dispose() => Disposed = true;
    }

    private sealed class CodexForeground : IForegroundAppService
    {
        public bool IsCodexForeground() => true;
    }

    private sealed class RecordingExecutor : IActionExecutor
    {
        public List<ActionInvocation> Invocations { get; } = [];
        public Task ExecuteAsync(ActionInvocation invocation, ActionExecutionOptions options,
            CancellationToken cancellationToken = default)
        {
            Invocations.Add(invocation);
            return Task.CompletedTask;
        }
    }
}
