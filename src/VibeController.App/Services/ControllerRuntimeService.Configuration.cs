using VibeController.Core.Domain;
using VibeController.Core.Mapping;
using VibeController.Core.Runtime;

namespace VibeController.App.Services;

public sealed partial class ControllerRuntimeService
{
    private MappingProfile? _formattedProfile;
    private IReadOnlyDictionary<string, string> _formattedMappings =
        new Dictionary<string, string>();

    private RuntimeConfigurationPayload BuildConfiguration()
    {
        if (!ReferenceEquals(_formattedProfile, _settings.Profile))
        {
            _formattedMappings = _settings.Profile.Mappings.ToDictionary(
                pair => FormatControl(pair.Key),
                pair => MappedActionCodec.Format(pair.Value));
            _formattedProfile = _settings.Profile;
        }

        return new RuntimeConfigurationPayload(
            _settings.ControllerType,
            _settings.ActiveControllerIndex,
            _settings.CodexOnly,
            FormatShortcut(_settings.DictationShortcut),
            _settings.MouseSpeed * 3.5f,
            _settings.ScrollSpeed * 6.25f,
            _settings.DeadZone,
            _settings.StartWithWindows,
            _formattedMappings,
            _settings.CodexLightbarEnabled,
            _microphoneStatus,
            _codexHookStatus,
            _codexActivity,
            _rc901aStatus,
            BuildRc901aInputStatus());
    }

    private static bool TryControl(string name, out ControllerControl control)
    {
        var normalized = name switch
        {
            "leftShoulder" => "LeftBumper",
            "rightShoulder" => "RightBumper",
            _ => name,
        };
        return Enum.TryParse(normalized, ignoreCase: true, out control);
    }

    private static KeyboardShortcut ParseShortcut(string text)
    {
        var parts = text.Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0) return new KeyboardShortcut();
        var modifiers = parts[..^1].Select(part => part.ToLowerInvariant() switch
        {
            "ctrl" or "control" => (KeyModifier?)KeyModifier.Control,
            "shift" => KeyModifier.Shift,
            "alt" => KeyModifier.Alt,
            "win" or "windows" or "meta" => KeyModifier.Windows,
            _ => null,
        }).Where(modifier => modifier.HasValue).Select(modifier => modifier!.Value);
        return new KeyboardShortcut(parts[^1], modifiers);
    }

    private static string FormatControl(ControllerControl control) => control switch
    {
        ControllerControl.LeftBumper => "leftShoulder",
        ControllerControl.RightBumper => "rightShoulder",
        _ => char.ToLowerInvariant(control.ToString()[0]) + control.ToString()[1..],
    };

    private static string FormatShortcut(KeyboardShortcut shortcut) => string.Join(
        "+",
        shortcut.Modifiers.Select(modifier => modifier switch
        {
            KeyModifier.Control => "Ctrl",
            KeyModifier.Shift => "Shift",
            KeyModifier.Alt => "Alt",
            KeyModifier.Windows => "Win",
            _ => modifier.ToString(),
        }).Append(shortcut.Key));
}
