using System.Collections.Concurrent;
using VibeController.Infrastructure.Windows;

namespace VibeController.Infrastructure.Tests.Windows;

public sealed class Rc901aShutdownContextTests
{
    [Fact]
    public async Task DisposeAsync_CompletesWithoutRequiringTheCallingUiContextToPump()
    {
        using var transport = new BlockingTransport();
        var client = new WindowsRc901aDriverInputClient(transport);
        await client.StartAsync(CancellationToken.None);
        Assert.True(transport.Entered.Wait(TimeSpan.FromSeconds(5)));
        var uiContext = new QueuedContext();
        var previous = SynchronizationContext.Current;
        Task disposal;
        SynchronizationContext.SetSynchronizationContext(uiContext);
        try { disposal = client.DisposeAsync().AsTask(); }
        finally { SynchronizationContext.SetSynchronizationContext(previous); }
        transport.Release.Set();
        try
        {
            await disposal.WaitAsync(TimeSpan.FromSeconds(1));
            Assert.True(transport.Disposed);
        }
        finally { uiContext.Drain(); }
    }

    private sealed class QueuedContext : SynchronizationContext
    {
        private readonly ConcurrentQueue<(SendOrPostCallback Callback, object? State)> _queue = new();
        public override void Post(SendOrPostCallback callback, object? state) => _queue.Enqueue((callback, state));
        public void Drain() { while (_queue.TryDequeue(out var item)) item.Callback(item.State); }
    }

    private sealed class BlockingTransport : IRc901aDriverSnapshotTransport
    {
        public ManualResetEventSlim Entered { get; } = new();
        public ManualResetEventSlim Release { get; } = new();
        public bool Disposed { get; private set; }
        public bool TryReadSnapshot(out byte[] snapshotBytes)
        {
            Entered.Set();
            Release.Wait();
            snapshotBytes = [];
            return false;
        }
        public void Dispose() { Disposed = true; }
    }
}
