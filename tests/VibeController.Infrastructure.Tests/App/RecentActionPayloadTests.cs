using System.Reflection;
using VibeController.App.Services;
using VibeController.Core.Domain;
using VibeController.Core.Execution;
using VibeController.Core.Mapping;
using VibeController.Core.Runtime;
using VibeController.Infrastructure.Settings;

namespace VibeController.Infrastructure.Tests.App;

public sealed class RecentActionPayloadTests
{
    [Fact]
    public async Task RecentActionUsesTheActualInvocation()
    {
        await using var service = new ControllerRuntimeService(new Store());
        var input = new InputEvent(ControllerControl.X, InputEdge.Pressed, 1, DateTimeOffset.UnixEpoch);
        var invocation = new ActionInvocation(new(MappedActionKind.KeyboardShortcut, new("F8")), input);
        var result = new RuntimeTickResult(State(true, false), false, [input],
            [new(ActionDispatchStatus.Dispatched, "输入已发出", invocation)]);
        var recent = Build(service, result);
        Assert.Equal("shortcut:F8", recent!.Action);
        Assert.Equal("dispatched", recent.Status);
    }

    [Theory]
    [InlineData(true, true, "test")]
    [InlineData(false, false, "paused")]
    [InlineData(true, false, "unmapped")]
    public async Task InputWithoutDispatchNeverClaimsExecution(bool enabled, bool test, string expected)
    {
        await using var service = new ControllerRuntimeService(new Store());
        var input = new InputEvent(ControllerControl.X, InputEdge.Pressed, 1, DateTimeOffset.UnixEpoch);
        var recent = Build(service, new(State(enabled, test), false, [input], []));
        Assert.Equal(expected, recent!.Status);
        Assert.Null(recent.Action);
    }

    private static RuntimeState State(bool enabled, bool test) => new(ControllerConnectionState.Connected, 0,
        enabled, test, 1, ControllerSnapshot.Empty);
    private static RecentActionPayload? Build(ControllerRuntimeService service, RuntimeTickResult result) =>
        (RecentActionPayload?)typeof(ControllerRuntimeService).GetMethod("BuildRecentAction", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(service, [result]);
    private sealed class Store : ISettingsStore
    {
        public Task<AppSettings> LoadAsync(CancellationToken token = default) => Task.FromResult(AppSettings.CreateDefault());
        public Task SaveAsync(AppSettings settings, CancellationToken token = default) => Task.CompletedTask;
    }
}
