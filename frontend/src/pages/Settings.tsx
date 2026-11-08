import { useEffect, useState } from "react";
import { Battery, Bluetooth, Clipboard, Gamepad2, Lightbulb, Mic2, Radio, RefreshCw, Trash2 } from "lucide-react";
import { AutoSaveFeedback } from "../components/AutoSaveFeedback";
import { SliderField } from "../components/SliderField";
import { Rc901aLearningPanel } from "../components/Rc901aLearningPanel";
import { rc901aPairingInstruction } from "../app/controllerPresentation";
import type {
  AutoSaveStatus,
  CodexActivityStatus,
  CodexHookRegistrationStatus,
  ControllerType,
  MicrophoneStatus,
  Rc901aInputStatus,
  Rc901aLearnableControl,
  Rc901aStatus,
} from "../app/types";

export interface SettingsValues {
  controllerType: ControllerType;
  codexOnly: boolean;
  startWithWindows: boolean;
  deadZone: number;
  mouseSpeed: number;
  scrollSpeed: number;
  activeControllerIndex: number;
  dictationShortcut: string;
  codexLightbarEnabled: boolean;
}

interface SettingsProps {
  onSave(values: SettingsValues): void;
  onCopyDiagnostics(): void;
  onRefreshIntegrations?(): void;
  onRefreshRc901a?(): void;
  onClearRc901aSamples?(): void;
  onStartRc901aLearning?(
    control: Rc901aLearnableControl,
    compatibilityOverride: true,
  ): void;
  onConfirmRc901aLearning?(sessionId: string): void;
  onRetryRc901aLearning?(sessionId: string): void;
  onCancelRc901aLearning?(sessionId: string): void;
  onResetRc901aLearnedBindings?(): void;
  initialValues?: SettingsValues;
  saveStatus?: AutoSaveStatus;
  persistedControllerType?: ControllerType;
  rc901aLearningReady?: boolean;
  microphone?: MicrophoneStatus;
  codexHook?: CodexHookRegistrationStatus;
  codexActivity?: CodexActivityStatus;
  rc901a?: Rc901aStatus;
  rc901aInput?: Rc901aInputStatus;
}

const defaultSettings: SettingsValues = {
  controllerType: "xbox",
  codexOnly: true,
  startWithWindows: false,
  deadZone: 0.18,
  mouseSpeed: 50,
  scrollSpeed: 50,
  activeControllerIndex: 0,
  dictationShortcut: "Ctrl+Alt+Shift+F12",
  codexLightbarEnabled: false,
};

function serializeSettings(values: SettingsValues) {
  return JSON.stringify(Object.fromEntries(Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))));
}

const activityLabels = {
  idle: "空闲",
  working: "工作中",
  needsAttention: "等待操作",
  completed: "已完成",
} as const;

export function Settings({
  onSave,
  onCopyDiagnostics,
  onRefreshIntegrations,
  onRefreshRc901a,
  onClearRc901aSamples,
  onStartRc901aLearning,
  onConfirmRc901aLearning,
  onRetryRc901aLearning,
  onCancelRc901aLearning,
  onResetRc901aLearnedBindings,
  initialValues,
  saveStatus,
  persistedControllerType,
  rc901aLearningReady = false,
  microphone,
  codexHook,
  codexActivity,
  rc901a,
  rc901aInput,
}: SettingsProps) {
  const [values, setValues] = useState<SettingsValues>(initialValues ?? defaultSettings);
  const serializedInitialValues = initialValues ? serializeSettings(initialValues) : null;
  useEffect(() => {
    if (serializedInitialValues === null || saveStatus?.state === "applying") return;
    setValues(JSON.parse(serializedInitialValues) as SettingsValues);
  }, [serializedInitialValues, saveStatus?.state]);
  const update = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onSave(next);
  };
  const microphoneName = microphone?.defaultDeviceName ?? (
    microphone?.state === "noDevices" ? "未检测到录音设备" : "等待检测"
  );
  const activityState = codexActivity?.state ?? "idle";
  const hookLabel = codexHook?.errorMessage
    ? "状态同步异常"
    : codexHook?.installed
      ? `已配置 · ${activityLabels[activityState]}`
      : values.codexLightbarEnabled
        ? "正在配置状态同步"
        : "未启用";
  const rc901aConnectionLabels = {
    idle: "等待连接",
    scanning: "正在查找",
    connecting: "正在连接",
    connected: "Windows HID 已连接",
    connectedLimited: "部分通道可用",
    disconnected: "已断开",
    error: "连接异常",
  } as const;
  const rc901aState = rc901a?.connectionState ?? "idle";
  const rc901aSamples = rc901a?.samples ?? [];
  const rc901aSelectionSaved = persistedControllerType === "tclRc901a";
  const rc901aLearningEnabled = rc901aSelectionSaved && rc901aLearningReady;
  const rc901aLearningUnavailableReason = !rc901aSelectionSaved
    ? "正在切换设备，请稍候"
    : !rc901aLearningReady
      ? "先连接遥控器"
      : undefined;

  return (
    <main className="workspace-page settings-page">
      <header className="page-heading">
        <div>
          <h1>设置</h1>
          <p>{initialValues ? "调整设备、输入手感和启动行为，修改后即生效。" : "等待应用配置…"}</p>
        </div>
        <AutoSaveFeedback status={saveStatus} />
      </header>

      <fieldset className="settings-grid" disabled={!initialValues}>
        <section className="settings-card device-settings-card">
          <h2>输入设备</h2>
          <fieldset className="device-family-picker">
            <legend>设备类型</legend>
            <div className="device-family-options">
              <label className="device-family-option" data-selected={values.controllerType === "xbox"}>
                <input aria-label="Xbox 无线手柄" type="radio" name="controllerType" value="xbox" checked={values.controllerType === "xbox"} onChange={() => update("controllerType", "xbox")} />
                <span className="device-family-icon"><Gamepad2 size={20} /></span>
                <span><strong>Xbox 无线手柄</strong><small>XInput · Xbox Series X|S</small></span>
                <span className="selection-dot" aria-hidden="true" />
              </label>
              <label className="device-family-option" data-selected={values.controllerType === "playStation5"}>
                <input aria-label="PS5 DualSense" type="radio" name="controllerType" value="playStation5" checked={values.controllerType === "playStation5"} onChange={() => update("controllerType", "playStation5")} />
                <span className="device-family-icon device-family-icon--ps">△○×□</span>
                <span><strong>PS5 DualSense</strong><small>USB / 蓝牙 · 支持触控板</small></span>
                <span className="selection-dot" aria-hidden="true" />
              </label>
              <label className="device-family-option" data-selected={values.controllerType === "tclRc901a"}>
                <input aria-label="TCL RC901A" type="radio" name="controllerType" value="tclRc901a" checked={values.controllerType === "tclRc901a"} onChange={() => update("controllerType", "tclRc901a")} />
                <span className="device-family-icon device-family-icon--remote"><Radio size={19} /></span>
                <span><strong>TCL RC901A</strong><small>Windows HID · BT_RC901A_B1</small></span>
                <span className="selection-dot" aria-hidden="true" />
              </label>
            </div>
          </fieldset>
          {values.controllerType !== "tclRc901a" && (
            <label className="field-stack">
              <span>活动控制器</span>
              <select aria-label="活动控制器" value={values.activeControllerIndex} onChange={(event) => update("activeControllerIndex", Number(event.target.value))}>
                {[0, 1, 2, 3].map((index) => <option key={index} value={index}>控制器 {index + 1}</option>)}
              </select>
            </label>
          )}
          {values.controllerType === "tclRc901a" && (
            <>
              <section className="rc901a-direct-panel" aria-label="RC901A Windows HID 状态">
                <div className="rc901a-panel-heading">
                  <div className="rc901a-device-identity">
                    <span className="rc901a-device-icon" aria-hidden="true"><Bluetooth size={18} /></span>
                    <div>
                      <small>Windows HID</small>
                      <strong>{rc901a?.deviceName ?? "BT_RC901A_B1"}</strong>
                    </div>
                  </div>
                  <span className="rc901a-state" data-state={rc901aState}>{rc901aConnectionLabels[rc901aState]}</span>
                </div>

                <div className="rc901a-metrics">
                  <span><Battery size={14} />{rc901a?.batteryPercent == null ? "电量未知" : `${rc901a.batteryPercent}% 电量`}</span>
                  <span><Radio size={14} />{rc901a?.subscribedCharacteristicCount ?? 0} 个数据通道</span>
                </div>
                <p className="rc901a-message">{rc901a?.message ?? "VibeController 会查找已配对的遥控器。"}</p>
                <p className="rc901a-guidance">{rc901aPairingInstruction} 专用驱动连接后，22 个已验证按键会自动就绪，无需逐键学习。麦克风键可在映射后触发 Codex 听写；遥控器自身音频暂未启用。</p>

                <div className="rc901a-actions">
                  <button className="quiet-button" type="button" onClick={onRefreshRc901a} disabled={!onRefreshRc901a}><RefreshCw size={14} />重新连接</button>
                  <button className="quiet-button" type="button" onClick={onClearRc901aSamples} disabled={!onClearRc901aSamples || rc901aSamples.length === 0}><Trash2 size={14} />清除记录</button>
                </div>

                <details className="rc901a-packet-log" >
                  <summary>原始输入数据 <span>{rc901aSamples.length}</span></summary>
                  {rc901aSamples.length === 0 ? (
                    <p>连接后按下遥控器按键，这里会显示只读数据。</p>
                  ) : (
                    <ol>
                      {[...rc901aSamples].reverse().map((sample, index) => (
                        <li key={`${sample.timestamp}-${sample.characteristicUuid}-${index}`}>
                          <code>{sample.dataHex || "∅"}</code>
                          <span>{sample.characteristicUuid.slice(4, 8).toUpperCase()} · {sample.length} B</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </details>
              </section>
              <Rc901aLearningPanel
                inputStatus={rc901aInput}
                learningEnabled={rc901aLearningEnabled}
                learningUnavailableReason={rc901aLearningUnavailableReason}
                onStart={onStartRc901aLearning}
                onConfirm={onConfirmRc901aLearning}
                onRetry={onRetryRc901aLearning}
                onCancel={onCancelRc901aLearning}
                onReset={onResetRc901aLearnedBindings}
              />
            </>
          )}
        </section>

        <section className="settings-card">
          <h2>使用方式</h2>
          <label className="switch-row">
            <span><strong>仅在目标应用前台时执行</strong><small>识别 Codex / DeepSeek Harness 并切换映射；关闭后全局使用 Codex 映射。</small></span>
            <input aria-label="仅在目标应用前台时执行" role="switch" aria-checked={values.codexOnly} type="checkbox" checked={values.codexOnly} onChange={(event) => update("codexOnly", event.target.checked)} />
          </label>
          <label className="switch-row">
            <span><strong>登录 Windows 后自动启动</strong><small>后台等待手柄连接，可随时从托盘打开。</small></span>
            <input aria-label="登录 Windows 后自动启动" role="switch" aria-checked={values.startWithWindows} type="checkbox" checked={values.startWithWindows} onChange={(event) => update("startWithWindows", event.target.checked)} />
          </label>
        </section>

        <section className="settings-card">
          <h2>输入手感</h2>
          <SliderField label="摇杆死区" value={Math.round(values.deadZone * 100)} min={5} max={35} onChange={(value) => update("deadZone", value / 100)} />
          <SliderField label="鼠标速度" value={values.mouseSpeed} min={10} max={100} onChange={(value) => update("mouseSpeed", value)} />
          <SliderField label="滚动速度" value={values.scrollSpeed} min={10} max={100} onChange={(value) => update("scrollSpeed", value)} />
        </section>

        <section className="settings-card integration-card">
          <div className="integration-heading">
            <div><h2>麦克风与灯条</h2></div>
            <button className="quiet-button" type="button" onClick={onRefreshIntegrations} disabled={!onRefreshIntegrations}>
              <RefreshCw size={14} />刷新检测
            </button>
          </div>

          <div className="integration-status-grid">
            <article className="integration-status-item" data-tone={microphone?.state === "error" ? "danger" : "info"}>
              <span className="integration-icon" aria-hidden="true"><Mic2 size={18} /></span>
              <div>
                <span className="integration-kicker">当前麦克风</span>
                <strong>{microphoneName}</strong>
                {microphone?.state === "error" ? <small>{microphone.message}</small> : <details className="microphone-guide"><summary>使用说明</summary><small>{microphone?.message ?? "VibeController 只读取设备名称，不录音；Codex 继续负责听写。"}</small></details>}
              </div>
            </article>

            <article className="integration-status-item" data-tone={microphone?.dualSenseMicrophoneAvailable ? "success" : "neutral"}>
              <span className="integration-icon" aria-hidden="true"><Gamepad2 size={18} /></span>
              <div>
                <span className="integration-kicker">手柄麦克风</span>
                <strong>{microphone?.dualSenseMicrophoneAvailable ? "已发现录音端点" : "当前不可用"}</strong>
                <details className="microphone-guide"><summary>连接说明</summary><small>{microphone?.dualSenseMicrophoneAvailable
                  ? "Codex 可在 Windows 选择该输入后使用原生听写。"
                  : "普通蓝牙连接未暴露 DualSense 麦克风；Codex 将使用上方的 Windows 默认输入。"}</small></details>
              </div>
            </article>
          </div>

          <div className="lightbar-panel">
            <label className="switch-row lightbar-switch">
              <span>
                <strong>使用 DualSense 灯条显示 Codex 状态</strong>
                <small>跟随 Codex 的工作状态；首次使用需在 Codex 中确认信任。</small>
              </span>
              <input aria-label="使用 DualSense 灯条显示 Codex 状态" role="switch" aria-checked={values.codexLightbarEnabled} type="checkbox" checked={values.codexLightbarEnabled} onChange={(event) => update("codexLightbarEnabled", event.target.checked)} />
            </label>
            <div className="lightbar-meta">
              <span className="hook-state" data-state={codexHook?.errorMessage ? "error" : codexHook?.installed ? "installed" : "off"}>
                <Lightbulb size={14} />{hookLabel}
              </span>
              {values.codexLightbarEnabled && <div className="lightbar-legend" aria-label="灯条颜色含义">
                <span><i data-color="working" />工作中</span>
                <span><i data-color="attention" />等待操作</span>
                <span><i data-color="completed" />已完成</span>
              </div>}
            </div>
            {codexHook?.errorMessage && <p className="integration-error">{codexHook.errorMessage}</p>}
          </div>
        </section>

        <details className="settings-card diagnostics-card">
          <summary>高级诊断</summary>
          <p>复制当前版本、设备状态和运行配置，便于排查连接问题。</p>
          <button className="quiet-button" type="button" onClick={onCopyDiagnostics}><Clipboard size={15} />复制诊断信息</button>
        </details>
      </fieldset>

    </main>
  );
}
