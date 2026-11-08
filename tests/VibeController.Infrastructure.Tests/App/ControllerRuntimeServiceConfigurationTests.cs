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
    public async Task AgentCatalogs_InitializeAndAutomaticallyPublishChangedKeysWithoutChangingMappings()
    {
        var keybindingsPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"codex-keys-{Guid.NewGuid():N}.json");
        try
        {
            var resolver = new CatalogResolver();
            var store = new RecordingSettingsStore();
            await using var service = new ControllerRuntimeService(store,
                foregroundAppService: new CodexForeground(), deepSeekShortcutResolver: resolver,
                codexShortcutResolver: new VibeController.Infrastructure.Windows.CodexShortcutResolver(keybindingsPath));
            var initial = BuildConfiguration(service).AgentShortcuts!;
            Assert.Equal("Ctrl+K", Assert.Single(initial["deepSeekHarness"]).Shortcut);
            Assert.Equal("Enter", initial["codex"].Single(option => option.Value == "send").Shortcut);
            resolver.Shortcut = "Ctrl+J";
            System.IO.File.WriteAllText(keybindingsPath, "[{\"command\":\"composer.submit\",\"key\":\"Ctrl+Enter\"}]");
            var changed = (bool)service.GetType().GetMethod("PollIntegrations", BindingFlags.Instance | BindingFlags.NonPublic)!
                .Invoke(service, [DateTimeOffset.UnixEpoch])!;
            Assert.True(changed);
            var updated = BuildConfiguration(service).AgentShortcuts!;
            Assert.Equal("Ctrl+J", Assert.Single(updated["deepSeekHarness"]).Shortcut);
            Assert.Equal("Ctrl+Enter", updated["codex"].Single(option => option.Value == "send").Shortcut);
            Assert.Equal(0, store.SaveCount);
            Assert.Equal("dictation", BuildConfiguration(service).AgentMappings!["codex"]["x"]);
        }
        finally { System.IO.File.Delete(keybindingsPath); }
    }

    private sealed class CatalogResolver : VibeController.Infrastructure.Windows.IDeepSeekShortcutResolver
    {
        public string Shortcut { get; set; } = "Ctrl+K";
        public KeyboardShortcut Resolve(string commandId) => throw new NotSupportedException();
        public IReadOnlyList<AgentShortcutOption> GetShortcuts() =>
            [new("deepseek:session.search", "搜索任务", Shortcut, "custom")];
    }

    [Fact]
    public async Task AgentProfiles_SaveAndResetIndependently_AndGlobalModeAlwaysUsesCodex()
    {
        var store = new RecordingSettingsStore();
        var foreground = new AgentForeground { Agent = AgentTarget.DeepSeekHarness };
        await using var service = new ControllerRuntimeService(store, foregroundAppService: foreground);
        await service.HandleCommandAsync(Command("updateMapping", new
        {
            agent = "deepSeekHarness", mappings = new { x = "shortcut:Ctrl+J" },
        }));
        var configuration = BuildConfiguration(service);
        Assert.Equal(AgentTarget.DeepSeekHarness, configuration.ActiveAgent);
        Assert.Equal("shortcut:Ctrl+J", configuration.Mappings["x"]);
        Assert.Equal("dictation", configuration.AgentMappings!["codex"]["x"]);
        Assert.Equal("J", store.Settings.DeepSeekHarnessProfile.Mappings[ControllerControl.X].Shortcut!.Key);

        foreground.Agent = AgentTarget.Codex;
        UpdateActiveProfile(service);
        Assert.Equal("dictation", BuildConfiguration(service).Mappings["x"]);
        foreground.Agent = null;
        UpdateActiveProfile(service);
        Assert.Equal(AgentTarget.Codex, BuildConfiguration(service).ActiveAgent);

        SetField(service, "_settings", store.Settings with { CodexOnly = false });
        foreground.Agent = AgentTarget.DeepSeekHarness;
        UpdateActiveProfile(service);
        Assert.Equal(AgentTarget.Codex, BuildConfiguration(service).ActiveAgent);
        Assert.Equal("dictation", BuildConfiguration(service).Mappings["x"]);

        await service.HandleCommandAsync(Command("resetDefaults", new { agent = "deepSeekHarness" }));
        Assert.Equal("dictation", BuildConfiguration(service).AgentMappings!["codex"]["x"]);
        Assert.Equal("none", BuildConfiguration(service).AgentMappings!["deepSeekHarness"]["x"]);
    }

    [Fact]
    public async Task AgentSwitch_UpdatesExistingRuntimeWithoutReEmittingHeldPress()
    {
        var store = new RecordingSettingsStore();
        var foreground = new AgentForeground { Agent = AgentTarget.Codex };
        var adapter = new DisposableAdapter();
        var executor = new RecordingExecutor();
        var runtime = new ControllerRuntime(adapter, new ActionDispatcher(foreground, executor), store.Settings.Profile);
        await using var service = new ControllerRuntimeService(store, foregroundAppService: foreground);
        SetField(service, "_runtime", runtime);
        await service.HandleCommandAsync(Command("updateMapping", new { x = "shortcut:Ctrl+K" }));
        foreground.Agent = AgentTarget.DeepSeekHarness;
        await service.HandleCommandAsync(Command("updateMapping", new
        {
            agent = "deepSeekHarness", mappings = new { x = "shortcut:Ctrl+J" },
        }));
        var options = new RuntimeOptions(0, true, false, 0.12f,
            new ActionExecutionOptions(true, new KeyboardShortcut("F12"), 1, 1, AgentTarget.DeepSeekHarness));
        await runtime.TickAsync(options, DateTimeOffset.UnixEpoch);
        Assert.Equal("J", Assert.Single(executor.Invocations).Action.Shortcut!.Key);
        foreground.Agent = AgentTarget.Codex;
        UpdateActiveProfile(service);
        var next = await runtime.TickAsync(options with
        {
            ActionOptions = options.ActionOptions with { TargetAgent = AgentTarget.Codex },
        }, DateTimeOffset.UnixEpoch.AddMilliseconds(16));
        Assert.Empty(next.InputEvents);
        Assert.Same(runtime, GetField<ControllerRuntime>(service, "_runtime"));
        Assert.False(adapter.Disposed);
    }

    private static void UpdateActiveProfile(ControllerRuntimeService service) =>
        service.GetType().GetMethod("UpdateActiveProfile", BindingFlags.Instance | BindingFlags.NonPublic)!
            .Invoke(service, null);

    private sealed class AgentForeground : IForegroundAppService
    {
        public AgentTarget? Agent { get; set; }
        public bool IsCodexForeground() => Agent == AgentTarget.Codex;
        public AgentTarget? GetForegroundAgent() => Agent;
    }

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
        await using var service = new ControllerRuntimeService(store, foregroundAppService: new CodexForeground());
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
    public async Task ResetAlreadyDefaultProfile_StillAcknowledgesWithAuthoritativeConfiguration()
    {
        await using var service = new ControllerRuntimeService(new RecordingSettingsStore(), foregroundAppService: new CodexForeground());
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
    public async Task RuntimePublication_OmitsHotConfigurationButReplaysAndFlushesPendingChanges()
    {
        await using var service = new ControllerRuntimeService(new RecordingSettingsStore(), foregroundAppService: new CodexForeground());
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
        using (var replay = JsonDocument.Parse(service.CurrentStateJson!))
        {
            Assert.Equal(2u, replay.RootElement.GetProperty("payload").GetProperty("packetNumber").GetUInt32());
            Assert.True(replay.RootElement.GetProperty("payload").TryGetProperty("configuration", out _));
        }
        // A pending configuration change must flush even when input has stopped.
        PublishTick(service, now.AddMilliseconds(250), 2);
        Assert.Equal(3, messages.Count);
        using var configuration = JsonDocument.Parse(messages[2]);
        Assert.Equal("none", configuration.RootElement.GetProperty("payload")
            .GetProperty("configuration").GetProperty("mappings").GetProperty("x").GetString());
        PublishTick(service, now.AddMilliseconds(266), 3, hasInput: true);
        await service.HandleCommandAsync(Command("updateMapping", new { x = "send" }));
        await service.HandleCommandAsync(Command("requestState", new { }));
        using var document = JsonDocument.Parse(messages[^1]);
        Assert.Equal(3u, document.RootElement.GetProperty("payload").GetProperty("packetNumber").GetUInt32());
        Assert.Equal("send", document.RootElement.GetProperty("payload")
            .GetProperty("configuration").GetProperty("mappings").GetProperty("x").GetString());
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
