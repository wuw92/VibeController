using VibeController.Core.Domain;

namespace VibeController.Core.Execution;

public interface IForegroundAppService
{
    bool IsCodexForeground();

    AgentTarget? GetForegroundAgent() => IsCodexForeground() ? AgentTarget.Codex : null;
}

public interface ICodexWindowService : IForegroundAppService
{
    bool TryActivateCodex();

    bool TryActivateDeepSeekHarness() => false;
}
