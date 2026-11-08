using VibeController.Core.Domain;
using VibeController.Infrastructure.Windows;

namespace VibeController.Infrastructure.Tests.Windows;

public sealed class AgentWindowMatcherTests
{
    [Theory]
    [InlineData("DeepSeek Harness", null, "任意会话标题", AgentTarget.DeepSeekHarness)]
    [InlineData("deepseek harness", null, "", AgentTarget.DeepSeekHarness)]
    [InlineData("ChatGPT", "C:\\WindowsApps\\OpenAI.Codex\\ChatGPT.exe", "任务名称", AgentTarget.Codex)]
    [InlineData("msedge", null, "DeepSeek Harness", null)]
    [InlineData("notepad", null, "Codex", null)]
    public void Match_UsesApplicationIdentityInsteadOfConversationTitle(
        string processName, string? path, string title, AgentTarget? expected) =>
        Assert.Equal(expected, AgentWindowMatcher.Match(processName, path, title));
}
