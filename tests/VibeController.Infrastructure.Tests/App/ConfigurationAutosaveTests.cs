using System.Text.Json.Serialization;
using System.Text.Json;
using VibeController.App.Services;
using VibeController.Core.Domain;
using VibeController.Core.Execution;
using VibeController.Core.Runtime;
using VibeController.Infrastructure.Settings;

namespace VibeController.Infrastructure.Tests.App;

public sealed class ConfigurationAutosaveTests
{
    [Fact]
    public async Task ResetCurrentControlPreservesOtherMappings()
    {
        var store = new Store();
        await using var service = new ControllerRuntimeService(store, foregroundAppService: new Foreground());
        await service.HandleCommandAsync(JsonSerializer.Serialize(new { version = 1, type = "updateMapping",
            payload = new { agent = "codex", mappings = new { x = "shortcut:F8", a = "shortcut:F9" } } }));
        await service.HandleCommandAsync(JsonSerializer.Serialize(new { version = 1, type = "resetDefaults",
            payload = new { agent = "codex", control = "x" } }));
        Assert.Equal("dictation", (await Configuration(service)).Mappings["x"]);
        Assert.Equal("shortcut:F9", (await Configuration(service)).Mappings["a"]);
    }

    [Fact]
    public async Task ChangesApplyImmediatelyAndBurstWritesPersistOnlyTheLatestSettings()
    {
        var store = new Store();
        await using var service = new ControllerRuntimeService(store, foregroundAppService: new Foreground());
        var replies = new List<string>();
        service.StateJsonReady += replies.Add;
        await Change(service, "one", "send");
        Assert.Equal("send", (await Configuration(service)).Mappings["x"]);
        Assert.Equal(0, store.Writes);
        using var reply = JsonDocument.Parse(replies.First());
        Assert.True(reply.RootElement.GetProperty("payload").GetProperty("succeeded").GetBoolean());
        await Change(service, "two", "none");
        await service.FlushSettingsAsync();
        Assert.Equal(1, store.Writes);
        Assert.Equal(MappedActionKind.None, store.Settings.Profile.Mappings[ControllerControl.X].Kind);
    }

    [Fact]
    public async Task DiskErrorsReportAnExceptionWithoutUndoingTheActiveChange()
    {
        var store = new Store { Fail = true };
        await using var service = new ControllerRuntimeService(store, foregroundAppService: new Foreground());
        var replies = new List<string>();
        service.StateJsonReady += replies.Add;
        await Change(service, "one", "send");
        await service.FlushSettingsAsync();
        Assert.Equal("send", (await Configuration(service)).Mappings["x"]);
        Assert.Equal(MappedActionKind.CodexDictation, store.Settings.Profile.Mappings[ControllerControl.X].Kind);
        using (var error = JsonDocument.Parse(replies.Last(value => value.Contains("settingsPersistence"))))
        {
            Assert.Equal("settingsPersistence", error.RootElement.GetProperty("type").GetString());
            Assert.Equal("disk_write_failed", error.RootElement.GetProperty("payload").GetProperty("error").GetString());
        }
        store.Fail = false;
        await Change(service, "two", "none");
        await service.FlushSettingsAsync();
        using var success = JsonDocument.Parse(replies.Last());
        Assert.Equal(JsonValueKind.Null, success.RootElement.GetProperty("payload").GetProperty("error").ValueKind);
    }

    [Fact]
    public async Task ASlowBackgroundWriteDoesNotBlockTheNextRuntimeChange()
    {
        var store = new Store { BlockFirst = true };
        await using var service = new ControllerRuntimeService(store, foregroundAppService: new Foreground());
        await Change(service, "one", "send");
        await store.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        try
        {
            await Change(service, "two", "none").WaitAsync(TimeSpan.FromSeconds(1));
            Assert.Equal("none", (await Configuration(service)).Mappings["x"]);
        }
        finally { store.Release.TrySetResult(); }
        await service.FlushSettingsAsync();
        Assert.Equal(MappedActionKind.None, store.Settings.Profile.Mappings[ControllerControl.X].Kind);
    }

    [Fact]
    public async Task InvalidKeyInputDoesNotReplaceTheCurrentBinding()
    {
        var store = new Store();
        await using var service = new ControllerRuntimeService(store, foregroundAppService: new Foreground());
        string? reply = null;
        service.StateJsonReady += value => reply = value;
        await Change(service, "one", "shortcut:F99");
        using var result = JsonDocument.Parse(reply!);
        Assert.False(result.RootElement.GetProperty("payload").GetProperty("succeeded").GetBoolean());
        Assert.Equal("dictation", (await Configuration(service)).Mappings["x"]);
        Assert.Equal(0, store.Writes);
    }

    private static Task Change(ControllerRuntimeService service, string id, string action) =>
        service.HandleCommandAsync(JsonSerializer.Serialize(new { version = 1, type = "updateMapping", requestId = id,
            payload = new { agent = "codex", mappings = new { x = action } } }));
    private static async Task<RuntimeConfigurationPayload> Configuration(ControllerRuntimeService service)
    {
        string? reply = null;
        void Receive(string json)
        {
            using var message = JsonDocument.Parse(json);
            if (message.RootElement.GetProperty("type").GetString() == "commandResult") reply = json;
        }
        service.StateJsonReady += Receive;
        try
        {
            await service.HandleCommandAsync(JsonSerializer.Serialize(new { version = 1, type = "requestState", requestId = "inspect", payload = new { } }));
            var options = new JsonSerializerOptions(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
            return JsonSerializer.Deserialize<BridgeMessage<CommandResultPayload>>(reply!, options)!.Payload.Configuration;
        }
        finally { service.StateJsonReady -= Receive; }
    }
    private sealed class Foreground : IForegroundAppService { public bool IsCodexForeground() => true; }
    private sealed class Store : ISettingsStore
    {
        public AppSettings Settings = AppSettings.CreateDefault();
        public bool Fail;
        public bool BlockFirst;
        public int Writes;
        public TaskCompletionSource Started = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Task<AppSettings> LoadAsync(CancellationToken token = default) => Task.FromResult(Settings);
        public async Task SaveAsync(AppSettings settings, CancellationToken token = default)
        {
            Writes++;
            Started.TrySetResult();
            if (BlockFirst && Writes == 1) await Release.Task;
            if (Fail) throw new IOException("disk_write_failed");
            Settings = settings;
        }
    }
}
