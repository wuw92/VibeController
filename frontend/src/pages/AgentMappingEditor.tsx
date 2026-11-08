import { useState } from "react";
import type { AgentTarget, AutoSaveStatus, RuntimeConfiguration } from "../app/types";
import { MappingEditor, type MappingValues } from "./MappingEditor";

interface AgentMappingEditorProps {
  configuration?: RuntimeConfiguration;
  onSave(agent: AgentTarget, mappings: MappingValues): void;
  onReset(agent: AgentTarget, control?: string): void;
  undoResetAgent?: AgentTarget;
  onUndoReset?(): void;
  saveStatus?: Record<string, AutoSaveStatus>;
}

export function AgentMappingEditor({ configuration, onSave, onReset, saveStatus, undoResetAgent, onUndoReset }: AgentMappingEditorProps) {
  const [agent, setAgent] = useState<AgentTarget>("codex");
  const [visited, setVisited] = useState<AgentTarget[]>(["codex"]);
  const selectAgent = (target: AgentTarget) => {
    setAgent(target);
    setVisited((current) => current.includes(target) ? current : [...current, target]);
  };
  return <>{visited.map((target) => <div key={target} hidden={target !== agent} role="group" aria-label={`${target} 映射`}>
    <MappingEditor agent={target} onAgentChange={selectAgent}
      saveStatus={saveStatus?.[target]}
      controllerType={configuration?.controllerType} codexOnly={configuration?.codexOnly}
      shortcutOptions={configuration?.agentShortcuts?.[target]}
      initialValues={configuration?.agentMappings?.[target] ?? (target === "codex" ? configuration?.mappings : undefined)}
      onSave={(mappings) => onSave(target, mappings)} onReset={() => onReset(target)} onResetControl={(control) => onReset(target, control)}
      onUndoReset={undoResetAgent === target ? onUndoReset : undefined} />
  </div>)}</>;
}
