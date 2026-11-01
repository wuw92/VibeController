import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Save } from "lucide-react";
import { ActionPicker, actionOptions } from "../components/ActionPicker";
import { ShortcutRecorder } from "../components/ShortcutRecorder";
import { getControllerPresentation } from "../app/controllerPresentation";
import type { ControllerType } from "../app/types";

export type MappingValues = Record<string, string>;

function serializeMappings(mappings: MappingValues) {
  return JSON.stringify(Object.fromEntries(Object.entries(mappings)
    .sort(([left], [right]) => left.localeCompare(right))));
}

const exclusiveActions = new Set(["dictation", "send", "cancel", "commandPalette", "previousChat", "nextChat", "activateCodex"]);
const codexShortcutActions = new Set([
  "dictation", "send", "commandPalette", "previousChat", "nextChat",
  "previousRecentThread", "nextRecentThread", "previousTab", "nextTab",
  "increaseReasoning", "decreaseReasoning",
]);
const actionLabels = new Map<string, string>(actionOptions);

function describeShortcut(shortcut: string | undefined) {
  if (!shortcut) return "键盘：请录入快捷键";
  const displayName = {
    Backspace: "Backspace（删除上一个字符）",
    ArrowUp: "↑（ArrowUp）",
    ArrowDown: "↓（ArrowDown）",
    ArrowLeft: "←（ArrowLeft）",
    ArrowRight: "→（ArrowRight）",
  }[shortcut] ?? shortcut;
  return `键盘：${displayName}`;
}

function describeMapping(action: string, shortcut: string | undefined) {
  return action === "keyboardShortcut"
    ? describeShortcut(shortcut)
    : actionLabels.get(action) ?? "未设置";
}

interface MappingEditorProps {
  controllerType?: ControllerType;
  onSave(values: MappingValues): void;
  onReset(): void;
  initialValues?: MappingValues;
}

export function MappingEditor({ controllerType = "xbox", onSave, onReset, initialValues }: MappingEditorProps) {
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
    setSaved(false);
    setResetting(false);
  }, [serializedIncoming, initialValues]);
  const selectedControl = controls.find((control) => control.key === selected);
  const selectedLabel = selectedControl?.label ?? selected;
  const conflict = useMemo(() => {
    const action = values[selected];
    if (!exclusiveActions.has(action)) return null;
    const match = controls.find((control) => control.key !== selected && values[control.key] === action);
    return match?.label ?? null;
  }, [selected, values]);
  const actionLabel = describeMapping(values[selected], shortcuts[selected]);

  const changeAction = (action: string) => {
    draftRevision.current++;
    setValues((current) => ({ ...current, [selected]: action }));
    setSaved(false);
  };

  const saveMapping = () => {
    const mappings = Object.fromEntries(Object.entries(values).map(([key, value]) =>
      [key, value === "keyboardShortcut" ? `shortcut:${shortcuts[key] ?? ""}` : value]));
    submissions.current.push({ snapshot: serializeMappings(mappings), revision: draftRevision.current });
    onSave(mappings);
    setSaved(true);
  };

  return (
    <main className="workspace-page">
      <header className="page-heading">
        <div><p className="eyebrow">Input map</p><h1>按键映射</h1><p>选择手柄按键，再绑定 Codex 快捷操作或键鼠输入。</p></div>
        <div className="page-actions">
          <button className="quiet-button" type="button" disabled={!initialValues || resetting} onClick={() => { submissions.current = []; setResetting(true); setSaved(false); onReset(); }}><RotateCcw size={15}/>恢复默认</button>
          <button className="primary-button" type="button" disabled={!initialValues || resetting} onClick={saveMapping}><Save size={15}/>保存映射</button>
        </div>
      </header>

      {!initialValues && <p role="status">等待主机配置；映射编辑暂不可用。</p>}
      <fieldset className="editor-grid" disabled={!initialValues || resetting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <section className="mapping-list" aria-label={`${presentation.statusName}按键列表`}>
          {controls.map(({ key, label, keycap }) => (
            <button key={key} type="button" aria-label={label} data-selected={selected === key} onClick={() => setSelected(key)}>
              <span className="keycap">{keycap}</span>
              <span><strong>{label}</strong><small>{describeMapping(values[key], shortcuts[key])}</small></span>
            </button>
          ))}
        </section>

        <section className="inspector-card">
          <div className="inspector-title"><span className="large-keycap">{selectedControl?.keycap ?? selectedLabel.split(" ")[0]}</span><div><p>正在编辑</p><h2>{selectedLabel}</h2></div></div>
          <ActionPicker value={values[selected] ?? "none"} onChange={changeAction} />
          {codexShortcutActions.has(values[selected]) && (
            <p className="codex-shortcut-note">
              <RefreshCw size={14} aria-hidden="true" />
              <span>首次触发时读取 Codex 当前快捷键；修改 Codex 设置后会自动刷新。</span>
            </p>
          )}
          {values[selected] === "keyboardShortcut" && <ShortcutRecorder value={shortcuts[selected] ?? ""} onChange={(shortcut) => { draftRevision.current++; setShortcuts((current) => ({ ...current, [selected]: shortcut })); setSaved(false); }} />}
          <div className="mapping-preview"><span>触发结果</span><strong>{actionLabel}</strong></div>
          {conflict && <p className="inline-warning" role="alert"><AlertTriangle size={16}/>与 {conflict}冲突；实际使用时两个按键都会触发该操作。</p>}
          {saved && <p className="save-confirmation" role="status">映射已保存</p>}
        </section>
      </fieldset>
    </main>
  );
}
