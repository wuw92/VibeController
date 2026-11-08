import { ArrowRight, Bluetooth, Crosshair, Pause, Play, Radio, Unplug } from "lucide-react";
import type { RuntimeStatePayload } from "../app/types";
import { getControllerPresentation } from "../app/controllerPresentation";
import { ControllerVisual } from "../components/ControllerVisual";
import { RecentAction } from "../components/RecentAction";
import { StatusPill } from "../components/StatusPill";
import { executionPresentation } from "../app/executionPresentation";
import { getMappingDisplay } from "../app/mappingActions";

interface DashboardProps {
  state: RuntimeStatePayload;
  onToggleMapping(enabled: boolean): void;
  onToggleTestMode?(enabled: boolean): void;
  onOpenMappings?(): void;
}

export function Dashboard({ state, onToggleMapping, onToggleTestMode, onOpenMappings }: DashboardProps) {
  const connected = state.connectionState === "connected";
  const execution = executionPresentation(state);
  const controllerType = state.configuration?.controllerType ?? "xbox";
  const presentation = getControllerPresentation(controllerType);

  const quickControls = presentation.controls.filter(({ key }) => state.configuration?.mappings[key] && state.configuration.mappings[key] !== "none").slice(0, 7);
  return (
    <main className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Controller workspace</p>
          <h1>设备状态</h1>
          <p className="subtitle">
            {state.configuration?.codexOnly === false ? "全局模式 · 使用 Codex 映射" : `前台自动切换 · ${state.configuration?.foregroundAgent === "deepSeekHarness" ? "DeepSeek Harness" : state.configuration?.foregroundAgent === "codex" ? "Codex" : "等待目标应用"}`}
          </p>
        </div>
        <div className="status-row" aria-label="运行状态">
          <StatusPill tone={connected ? "success" : "danger"}>
            {connected ? presentation.connectedLabel : "手柄未连接"}
          </StatusPill>
          <StatusPill tone={execution.tone}>{execution.label}</StatusPill>
        </div>
      </div>

      <div className="dashboard-grid">
        <section
          className="controller-card"
          data-disconnected={!connected}
          aria-label="设备实时状态"
        >
          <div className="controller-meta">
            <span>{presentation.name}</span>
            <span>{controllerType === "tclRc901a"
              ? `Windows HID · 数据包 ${state.packetNumber}`
              : `控制器 ${state.controllerIndex + 1} · 数据包 ${state.packetNumber}`}</span>
          </div>
          <ControllerVisual controllerType={controllerType} controls={state.controls} />
          {!connected && (
            <div className="disconnect-overlay">
              <Unplug size={22} aria-hidden="true" />
              <strong>等待 {presentation.waitingName}</strong>
              <p>连接后会自动恢复，无需重新配置</p>
            </div>
          )}
        </section>

        <aside className="side-stack">
          <section className="side-card">
            <div className="side-card-label">
              <span>映射控制</span>
              {connected ? <Bluetooth size={15} /> : <Radio size={15} />}
            </div>
            {execution.label === "等待目标应用" && <p className="execution-note">普通输入等待目标应用前台；激活窗口和全局听写仍可用。</p>}
            <div className="control-buttons">
              <button className={state.mappingEnabled ? "quiet-button" : "primary-button"} type="button" onClick={() => onToggleMapping(!state.mappingEnabled)}>
                {state.mappingEnabled ? <Pause size={15} /> : <Play size={15} />}
                {state.mappingEnabled ? "暂停映射" : "启用映射"}
              </button>
              {onToggleTestMode && <button className="quiet-button" type="button" onClick={() => onToggleTestMode(!state.testMode)}><Crosshair size={15}/>{state.testMode ? "退出测试" : "测试输入"}</button>}
            </div>
          </section>

          <section className="side-card">
            <div className="side-card-label"><span>最近动作</span><span>即时</span></div>
            <RecentAction action={state.lastAction} recent={state.recentAction} configuration={state.configuration} />
          </section>

          <section className="side-card">
            <div className="side-card-label"><span>当前快捷操作</span><span>{state.configuration?.activeAgent === "deepSeekHarness" ? "DeepSeek Harness" : "Codex"}</span></div>
            <div className="control-list">
              {!state.configuration && <p>等待主机配置</p>}
              {quickControls.map(({ key, keycap }) => {
                const action = state.configuration?.mappings[key];
                if (!action || action === "none") return null;
                const mapping = getMappingDisplay(action,
                  state.configuration?.agentShortcuts?.[state.configuration.activeAgent ?? "codex"]);
                return <div className="control-row" key={key}>
                  <span className="control-row-description"><span>{mapping.label}</span>{mapping.shortcut && <small>{mapping.shortcut}</small>}</span>
                  <span className="keycap">{keycap}</span>
                </div>;
              })}
            </div>
            {onOpenMappings && <button className="quiet-button mapping-link" type="button" onClick={onOpenMappings}>查看全部映射<ArrowRight size={14}/></button>}
          </section>
        </aside>
      </div>
    </main>
  );
}
