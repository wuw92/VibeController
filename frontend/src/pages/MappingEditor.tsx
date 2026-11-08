import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ActionPicker } from "../components/ActionPicker";
import { codexShortcutActions, getMappingDisplay } from "../app/mappingActions";
import { AutoSaveFeedback } from "../components/AutoSaveFeedback";
import { ShortcutRecorder } from "../components/ShortcutRecorder";
import { getControllerPresentation } from "../app/controllerPresentation";
import type { AgentShortcutOption, AgentTarget, AutoSaveStatus, ControllerType } from "../app/types";

export type MappingValues = Record<string, string>;

const exclusiveActions = new Set(["dictation", "send", "cancel", "commandPalette", "previousChat", "nextChat", "activateCodex"]);
const sourceLabels = { custom: "自定义", default: "应用默认", fixed: "应用固定", error: "读取失败" };

interface MappingEditorProps {
  agent?: AgentTarget;
  shortcutOptions?: AgentShortcutOption[];
  onAgentChange?(agent: AgentTarget): void;
  codexOnly?: boolean;
  controllerType?: ControllerType;
  onSave(values: MappingValues): void;
  onReset(): void;
  onResetControl?(control: string): void;
  onUndoReset?(): void;
  initialValues?: MappingValues;
  saveStatus?: AutoSaveStatus;
}

export function MappingEditor({ agent = "codex", shortcutOptions, onAgentChange, codexOnly,
  controllerType = "xbox", onSave, onReset, onResetControl, onUndoReset, initialValues, saveStatus }: MappingEditorProps) {
  const presentation = getControllerPresentation(controllerType);
  const controls = presentation.controls;
  const incoming = initialValues ?? {};
  const [selected, setSelected] = useState(controls[0]?.key ?? "x");
  useEffect(() => setSelected(controls[0]?.key ?? "x"), [controls]);
  const [recordingControl, setRecordingControl] = useState<string | null>(null);
  const values = Object.fromEntries(Object.entries(incoming).map(([key, value]) =>
    [key, value.startsWith("shortcut:") ? "keyboardShortcut" : value]));
  if (recordingControl) values[recordingControl] = "keyboardShortcut";
  const shortcuts = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value.startsWith("shortcut:"))
    .map(([key, value]) => [key, value.slice(9)]));
  const selectedControl = controls.find((control) => control.key === selected);
  const selectedLabel = selectedControl?.label ?? selected;
  const conflict = useMemo(() => {
    const action = values[selected];
    if (!exclusiveActions.has(action) && !action?.startsWith("deepseek:")) return null;
    const match = controls.find((control) => control.key !== selected && values[control.key] === action);
    return match?.label ?? null;
  }, [selected, values]);
  const mappings = incoming;
  const incompleteShortcut = recordingControl === selected && !shortcuts[selected];
  const display = getMappingDisplay(mappings[selected], shortcutOptions);
  const agentName = agent === "codex" ? "Codex" : "DeepSeek Harness";
  const hasAppShortcut = codexShortcutActions.has(values[selected]) || values[selected]?.startsWith("deepseek:") || values[selected] === "cancel";

  const changeAction = (action: string) => {
    setRecordingControl(action === "keyboardShortcut" ? selected : null);
    if (action !== "keyboardShortcut" || shortcuts[selected])
      onSave({ ...incoming, [selected]: action === "keyboardShortcut" ? `shortcut:${shortcuts[selected]}` : action });
  };

  return (
    <main className="workspace-page mapping-page">
      <header className="page-heading">
        <div><h1>按键映射</h1><p>选择按键并修改绑定，修改后即生效。</p></div>
        <div className="page-actions">
          {onUndoReset && <button className="quiet-button" type="button" onClick={onUndoReset}>撤销重置</button>}
          <button className="quiet-button" type="button" disabled={!initialValues || saveStatus?.state === "applying"} onClick={onReset}><RotateCcw size={15}/>重置 {agentName} 全部映射</button>
        </div>
      </header>

      <div className="mapping-toolbar">
        {onAgentChange && <label className="field-stack"><span>配置 Agent</span>
          <select aria-label="配置 Agent" value={agent} onChange={(event) => onAgentChange(event.target.value as AgentTarget)}>
            <option value="codex">Codex</option><option value="deepSeekHarness">DeepSeek Harness</option>
          </select>
        </label>}
        <p className="mapping-mode">{codexOnly === false ? "全局模式：始终使用 Codex 映射。" : "自动识别前台应用，使用对应 Agent 的映射。"}</p>
        <AutoSaveFeedback status={saveStatus} />
      </div>

      {!initialValues && <p role="status">等待主机配置；映射编辑暂不可用。</p>}
      <fieldset className="editor-grid" disabled={!initialValues}>
        <section className="mapping-list" aria-label={`${presentation.statusName}按键列表`}>
          {controls.map(({ key, label, keycap }) => {
            const mapping = getMappingDisplay(mappings[key], shortcutOptions);
            return (
            <button key={key} type="button" aria-label={label} data-selected={selected === key} onClick={() => setSelected(key)}>
              <span className="keycap">{keycap}</span>
              <span className="mapping-row-body"><strong>{label}</strong><small>{mapping.label}</small></span>
              {mapping.shortcut && <span className="mapping-row-shortcut" title={mapping.shortcut}>{mapping.shortcut}</span>}
            </button>
          ); })}
        </section>

        <section className="inspector-card">
          <div className="inspector-title"><h2>{selectedLabel}</h2>{onResetControl && <button className="quiet-button reset-control" type="button" onClick={() => onResetControl(selected)}>重置此按键</button>}</div>
          <ActionPicker control={selected} agent={agent} shortcutOptions={shortcutOptions} value={values[selected] ?? "none"} onChange={changeAction} />
          {hasAppShortcut && <section className="shortcut-detail" aria-label="当前生效快捷键">
            <div className="shortcut-detail-heading"><span>快捷键</span>{display.source && <span className="shortcut-source">{sourceLabels[display.source]}</span>}</div>
            <kbd>{display.shortcut ?? (display.message ? "未绑定或不可用" : "正在读取…")}</kbd>
            {display.message && <p>{display.message}</p>}
          </section>}
          {values[selected] === "keyboardShortcut" && <ShortcutRecorder value={shortcuts[selected] ?? ""} onChange={(shortcut) => { setRecordingControl(null); onSave({ ...mappings, [selected]: `shortcut:${shortcut}` }); }} />}
          {incompleteShortcut && <p className="inline-warning"><AlertTriangle size={16}/>录入完整快捷键后自动生效。</p>}
          {conflict && <p className="duplicate-binding">重复绑定：{conflict} 也会触发该操作。</p>}
        </section>
      </fieldset>
    </main>
  );
}
