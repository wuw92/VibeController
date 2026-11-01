using VibeController.Core.Devices;
using VibeController.Core.Runtime;

namespace VibeController.App.Services;

public sealed partial class ControllerRuntimeService
{
    private readonly object _rc901aLearningGate = new();
    private readonly Rc901aLearningSession _rc901aLearning = new();
    private bool _rc901aInputSubscribed;
    private Rc901aUnknownInputSignal? _lastUnknownRc901aInput;
    private CancellationTokenSource? _rc901aLearningSaveCancellation;

    private void SubscribeToRc901aInput()
    {
        if (_rc901aRawInputSource is null || _rc901aInputSubscribed)
        {
            return;
        }

        _rc901aRawInputSource.InputReceived += OnRc901aInputReceived;
        _rc901aInputSubscribed = true;
    }

    private void UnsubscribeFromRc901aInput()
    {
        if (_rc901aRawInputSource is null || !_rc901aInputSubscribed)
        {
            return;
        }

        _rc901aRawInputSource.InputReceived -= OnRc901aInputReceived;
        _rc901aInputSubscribed = false;
    }

    private void OnRc901aInputReceived(Rc901aRawInputEvent input)
    {
        var effectiveBindings = GetEffectiveRc901aBindings();
        var recordUnknown = input.IsPressed && effectiveBindings.All(item =>
            item.Kind != input.Kind || item.Code != input.Code);
        bool learningChanged;
        lock (_rc901aLearningGate)
        {
            if (recordUnknown)
            {
                _lastUnknownRc901aInput = new Rc901aUnknownInputSignal(
                    input.Kind, input.Code, input.Timestamp);
            }
            learningChanged = _rc901aLearning.ObserveInput(input, effectiveBindings);
        }

        if (recordUnknown || learningChanged)
        {
            Interlocked.Increment(ref _configurationRevision);
            _stateDirty = true;
        }
    }

    private bool ExpireRc901aLearning(DateTimeOffset now)
    {
        lock (_rc901aLearningGate)
        {
            if (!_rc901aLearning.Expire(now)) return false;
            _rc901aLearningSaveCancellation?.Cancel();
        }
        _stateDirty = true;
        return true;
    }

    private bool DisconnectRc901aLearning()
    {
        lock (_rc901aLearningGate)
        {
            if (!_rc901aLearning.Disconnect()) return false;
            _rc901aLearningSaveCancellation?.Cancel();
        }
        _stateDirty = true;
        return true;
    }

    private bool IsRc901aLearningActive()
    {
        lock (_rc901aLearningGate)
        {
            return _rc901aLearning.IsActive;
        }
    }

    private Rc901aInputStatus? BuildRc901aInputStatus()
    {
        if (_rc901aRawInputSource is null) return null;
        lock (_rc901aLearningGate)
        {
            return new Rc901aInputStatus(
                GetEffectiveRc901aBindings(),
                _lastUnknownRc901aInput,
                _rc901aLearning.Status);
        }
    }

    private IReadOnlyList<Rc901aInputBinding> GetEffectiveRc901aBindings() =>
        Rc901aInputBindings.CombineWithVerifiedDefaults(_settings.Rc901aLearnedBindings);
}
