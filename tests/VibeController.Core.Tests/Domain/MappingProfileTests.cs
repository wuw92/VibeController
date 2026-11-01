using VibeController.Core.Domain;
using VibeController.Core.Mapping;

namespace VibeController.Core.Tests.Domain;

public sealed class MappingProfileTests
{
    [Fact]
    public void WithMappings_AppliesBatchWithoutChangingOriginal()
    {
        var original = DefaultProfileFactory.Create();
        var updated = original.WithMappings(
        [
            new(ControllerControl.A, new MappedAction(MappedActionKind.Cancel)),
            new(ControllerControl.B, new MappedAction(MappedActionKind.Send)),
        ]);

        Assert.Equal(original.Name, updated.Name);
        Assert.Equal(MappedActionKind.Send, original.Mappings[ControllerControl.A].Kind);
        Assert.Equal(MappedActionKind.Cancel, updated.Mappings[ControllerControl.A].Kind);
        Assert.Equal(MappedActionKind.Send, updated.Mappings[ControllerControl.B].Kind);
        Assert.Equal(original.Mappings[ControllerControl.X], updated.Mappings[ControllerControl.X]);
    }

    [Fact]
    public void WithMapping_NoChangeReusesImmutableDictionary()
    {
        var original = DefaultProfileFactory.Create();
        var updated = original.WithMapping(ControllerControl.A, original.Mappings[ControllerControl.A]);
        Assert.Same(original.Mappings, updated.Mappings);
    }
}
