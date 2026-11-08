using VibeController.App.Services;

namespace VibeController.Infrastructure.Tests.App;

public sealed class SingleInstanceGuardTests
{
    [Fact]
    public void Guard_BlocksAnotherRuntimeAndReleasesOwnershipOnExit()
    {
        var name = @"Local\VibeController.Tests." + Guid.NewGuid().ToString("N");
        using var ready = new ManualResetEventSlim();
        using var finish = new ManualResetEventSlim();
        var firstOwned = false;
        var owner = new Thread(() =>
        {
            using var guard = new SingleInstanceGuard(name);
            firstOwned = guard.IsFirstInstance;
            ready.Set();
            finish.Wait();
        });
        owner.Start();
        try
        {
            Assert.True(ready.Wait(TimeSpan.FromSeconds(5)));
            Assert.True(firstOwned);
            using var duplicate = new SingleInstanceGuard(name);
            Assert.False(duplicate.IsFirstInstance);
        }
        finally { finish.Set(); owner.Join(); }
        using var restarted = new SingleInstanceGuard(name);
        Assert.True(restarted.IsFirstInstance);
        restarted.Dispose();
    }

    [Fact]
    public void Guard_RecoversAfterTheOwnerThreadStopsUnexpectedly()
    {
        var name = @"Local\VibeController.Tests." + Guid.NewGuid().ToString("N");
        SingleInstanceGuard? abandoned = null;
        var owner = new Thread(() => abandoned = new SingleInstanceGuard(name));
        owner.Start();
        owner.Join();
        using var recovered = new SingleInstanceGuard(name);
        Assert.True(recovered.IsFirstInstance);
        GC.KeepAlive(abandoned);
    }
}
