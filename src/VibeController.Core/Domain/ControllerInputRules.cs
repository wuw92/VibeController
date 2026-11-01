namespace VibeController.Core.Domain;

internal static class ControllerInputRules
{
    private static readonly ControllerControl[] RepeatableControls =
    [
        ControllerControl.DPadUp,
        ControllerControl.DPadDown,
        ControllerControl.DPadLeft,
        ControllerControl.DPadRight,
        ControllerControl.RightStickUp,
        ControllerControl.RightStickDown,
        ControllerControl.RightStickLeft,
        ControllerControl.RightStickRight,
        ControllerControl.RemoteUp,
        ControllerControl.RemoteDown,
        ControllerControl.RemoteLeft,
        ControllerControl.RemoteRight,
    ];

    internal static bool IsRepeatable(ControllerControl control) =>
        Array.IndexOf(RepeatableControls, control) >= 0;
}
