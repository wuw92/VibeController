import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import { ActionPicker } from "../components/ActionPicker";
import { codexShortcutActions, getMappingDisplay } from "../app/mappingActions";
import { ShortcutRecorder } from "../components/ShortcutRecorder";
import { getControllerPresentation } from "../app/controllerPresentation";
import type { AgentShortcutOption, AgentTarget, ControllerType } from "../app/types";

export type MappingValues = Record<string, string>;

function serializeMappings(mappings: MappingValues) {
  return JSON.stringify(Object.fromEntries(Object.entries(mappings)
    .sort(([left], [right]) => left.localeCompare(right))));
}

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
  initialValues?: MappingValues;
}

export function MappingEditor({ agent = "codex", shortcutOptions, onAgentChange, codexOnly,
  controllerType = "xbox", onSave, onReset, initialValues }: MappingEditorProps) {
  const presentation = getControllerPresentation(controllerType);
  const controls = presentation.controls;
  const incoming = initialValues ?? {};
  const incomingActions = Object.fromEntries(Object.entries(incoming).map(([key, value]) => [key, value.startsWith("shortcut:") ? "keyboardShortcut" : value]));
  const incomingShortcuts = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value.startsWith("shortcut:")).map(([key, value]) => [key, value.slice(9)]));
  const [selected, setSelected] = useState(controls[0]?.key ?? "x");
  useEffect(() => setSelected(controls[0]?.key ?? "x"), [controls]);
  const [values, setValues] = useState(incomingActions);
  const [shortcuts, setShortcuts] = useState(incomingShortcuts);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const draftRevision = useRef(0);
  const submissions = useRef<{ snapshot: string; revision: number }[]>([]);
  const serializedIncoming = serializeMappings(incoming);
  const lastIncoming = useRef<string | undefined>(undefined);
  useEffect(() => {
    const acknowledgedIndex = submissions.current
      .map((submission) => submission.snapshot).lastIndexOf(serializedIncoming);
    if (acknowledgedIndex >= 0) {
      const acknowledged = submissions.current[acknowledgedIndex];
      submissions.current.splice(0, acknowledgedIndex + 1);
      setSaving(false);
      setSaved(draftRevision.current === acknowledged.revision);
      if (!resetting && draftRevision.current > acknowledged.revision) {
        lastIncoming.current = serializedIncoming;
        return;
      }
    }
    if (lastIncoming.current === serializedIncoming && !resetting) return;
    lastIncoming.current = serializedIncoming;
    const mappings = JSON.parse(serializedIncoming) as MappingValues;
    setValues(Object.fromEntries(Object.entries(mappings).map(([key, value]) =>
      [key, value.startsWith("shortcut:") ? "keyboardShortcut" : value])));
    setShortcuts(Object.fromEntries(Object.entries(mappings)
      .filter(([, value]) => value.startsWith("shortcut:"))
      .map(([key, value]) => [key, value.slice(9)])));
    if (acknowledgedIndex < 0) setSaved(false);
    setResetting(false);
  }, [serializedIncoming, initialValues]);
  const selectedControl = controls.find((control) => control.key === selected);
  const selectedLabel = selectedControl?.label ?? selected;
  const conflict = useMemo(() => {
    const action = values[selected];
    if (!exclusiveActions.has(action) && !action?.startsWith("deepseek:")) return null;
    const match = controls.find((control) => control.key !== selected && values[control.key] === action);
    return match?.label ?? null;
  }, [selected, values]);
  const mappings = Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, value === "keyboardShortcut" ? `shortcut:${shortcuts[key] ?? ""}` : value]));
  const dirty = serializeMappings(mappings) !== serializedIncoming;
  const incompleteShortcut = Object.entries(values).some(([key, value]) => value === "keyboardShortcut" && !shortcuts[key]);
  const display = getMappingDisplay(mappings[selected], shortcutOptions);
  const agentName = agent === "codex" ? "Codex" : "DeepSeek Harness";
  const hasAppShortcut = codexShortcutActions.has(values[selected]) || values[selected]?.startsWith("deepseek:") || values[selected] === "cancel";

  const changeAction = (action: string) => {
    draftRevision.current++;
    setValues((current) => ({ ...current, [selected]: action }));
    setSaved(false);
  };

  const saveMapping = () => {
    submissions.current.push({ snapshot: serializeMappings(mappings), revision: draftRevision.current });
    setSaving(true);
    onSave(mappings);
    setSaved(false);
  };

  return (
    <main className="workspace-page mapping-page">
      <header className="page-heading">
        <div><p className="eyebrow">Input map</p><h1>按键映射</h1><p>选择按键，再绑定应用操作或键鼠输入。</p></div>
        <div className="page-actions">
          <button className="quiet-button" type="button" disabled={!initialValues || resetting} onClick={() => { submissions.current = []; setResetting(true); setSaved(false); setSaving(false); onReset(); }}><RotateCcw size={15}/>恢复默认</button>
          <button className="primary-button" type="button" disabled={!initialValues || resetting || incompleteShortcut} onClick={saveMapping}><Save size={15}/>保存映射</button>
        </div>
      </header>

      <div className="mapping-toolbar">
        {onAgentChange && <label className="field-stack"><span>配置 Agent</span>
          <select aria-label="配置 Agent" value={agent} onChange={(event) => onAgentChange(event.target.value as AgentTarget)}>
            <option value="codex">Codex</option><option value="deepSeekHarness">DeepSeek Harness</option>
          </select>
        </label>}
        <p className="mapping-mode">{codexOnly === false ? "全局模式：始终使用 Codex 映射。" : "自动识别前台应用，使用对应 Agent 的映射。"}</p>
        <span className="mapping-save-status" data-state={saved ? "saved" : "idle"} role="status">
          {resetting ? "正在恢复默认…" : saving ? "正在保存…" : dirty ? "有未保存的更改" : saved ? "映射已保存" : ""}
        </span>
      </div>

      {!initialValues && <p role="status">等待主机配置；映射编辑暂不可用。</p>}
      <fieldset className="editor-grid" disabled={!initialValues || resetting}>
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
          <div className="inspector-title"><span className="large-keycap">{selectedControl?.keycap ?? selectedLabel.split(" ")[0]}</span><div><p>正在编辑</p><h2>{selectedLabel}</h2></div></div>
          <ActionPicker agent={agent} shortcutOptions={shortcutOptions} value={values[selected] ?? "none"} onChange={changeAction} />
          {hasAppShortcut && <section className="shortcut-detail" aria-label="当前生效快捷键">
            <div className="shortcut-detail-heading"><span>当前快捷键</span>{display.source && <span className="shortcut-source">{sourceLabels[display.source]}</span>}</div>
            <kbd>{display.shortcut ?? (display.message ? "未绑定或不可用" : "正在读取…")}</kbd>
            <p>{display.message ?? (values[selected] === "cancel" ? "键盘固定操作。" : `由 ${agentName} 管理，设置变化后自动同步。`)}</p>
          </section>}
          {values[selected] === "keyboardShortcut" && <ShortcutRecorder value={shortcuts[selected] ?? ""} onChange={(shortcut) => { draftRevision.current++; setShortcuts((current) => ({ ...current, [selected]: shortcut })); setSaved(false); }} />}
          <div className="mapping-preview"><span>触发结果</span><strong>{display.label}</strong></div>
          {incompleteShortcut && <p className="inline-warning"><AlertTriangle size={16}/>请先录入自定义快捷键，再保存映射。</p>}
          {conflict && <p className="inline-warning" role="alert"><AlertTriangle size={16}/>与 {conflict}冲突；实际使用时两个按键都会触发该操作。</p>}
        </section>
      </fieldset>
    </main>
  );
}
