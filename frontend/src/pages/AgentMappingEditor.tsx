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
  return <div role="group" aria-label={`${agent} 映射`}>
    <MappingEditor key={agent} agent={agent} onAgentChange={setAgent}
      saveStatus={saveStatus?.[agent]}
      controllerType={configuration?.controllerType} codexOnly={configuration?.codexOnly}
      shortcutOptions={configuration?.agentShortcuts?.[agent]}
      initialValues={configuration?.agentMappings?.[agent] ?? (agent === "codex" ? configuration?.mappings : undefined)}
      onSave={(mappings) => onSave(agent, mappings)} onReset={() => onReset(agent)} onResetControl={(control) => onReset(agent, control)}
      onUndoReset={undoResetAgent === agent ? onUndoReset : undefined} />
  </div>;
}
