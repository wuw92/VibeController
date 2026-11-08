import type { AgentShortcutOption, AgentTarget } from "../app/types";
import { actionOptions, codexShortcutActions, continuousControls } from "../app/mappingActions";
export { actionOptions } from "../app/mappingActions";

interface ActionPickerProps {
  value: string;
  onChange(value: string): void;
  agent?: AgentTarget;
  shortcutOptions?: AgentShortcutOption[];
  control?: string;
}

export function ActionPicker({ value, onChange, agent = "codex", shortcutOptions, control }: ActionPickerProps) {
  const continuous = continuousControls.has(control ?? "");
  const agentName = agent === "codex" ? "Codex" : "DeepSeek Harness";
  const activation = agent === "codex" ? "activateCodex" : "activateDeepSeekHarness";
  const commands = shortcutOptions ?? (agent === "codex"
    ? actionOptions.filter(([kind]) => codexShortcutActions.has(kind)).map(([value, label]) => ({ value, label })) : []);
  const common = actionOptions.filter(([kind]) => !codexShortcutActions.has(kind) &&
    kind !== "activateCodex" && kind !== "activateDeepSeekHarness");
  return <label className="field-stack">
    <span>绑定操作</span>
    <select aria-label="绑定操作" value={value} onChange={(event) => onChange(event.target.value)}>
      {continuous ? actionOptions.filter(([kind]) => ["mouseMove", "mouseScroll", "none"].includes(kind))
        .map(([kind, label]) => <option key={kind} value={kind}>{label}</option>) : <>
      <optgroup label={`${agentName} 操作`}>
        {commands.map((option) => <option key={option.value} value={option.value}>
          {actionOptions.find(([kind]) => kind === option.value)?.[1] ?? option.label}
        </option>)}
        <option value={activation}>激活 {agentName} 窗口</option>
      </optgroup>
      <optgroup label="键盘与鼠标">
        {common.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
      </optgroup>
      </>}
    </select>
  </label>;
}
