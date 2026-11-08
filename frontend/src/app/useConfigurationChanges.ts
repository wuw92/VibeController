import { useEffect, useMemo, useRef, useState } from "react";
import { appBridge } from "./AppBridge";
import type { AgentTarget, AutoSaveStatus, CommandType, RuntimeConfiguration } from "./types";
import type { SettingsValues } from "../pages/Settings";

type Mappings = Record<string, string>;
type Change = { apply?: (configuration: RuntimeConfiguration) => RuntimeConfiguration; acceptedRevision?: number };

export function useConfigurationChanges(confirmed?: RuntimeConfiguration) {
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const latest = useRef<Record<string, Change>>({});
  const [undo, setUndo] = useState<{ agent: AgentTarget; mappings: Mappings } | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  useEffect(() => appBridge.subscribe((message) => {
    if (message.type === "settingsPersistence") setPersistenceError(message.payload.error);
  }), []);

  const active = Object.entries(changes).filter(([, change]) => change.acceptedRevision === undefined ||
    (confirmed?.revision ?? 0) < change.acceptedRevision);
  const configuration = useMemo(() => confirmed && Object.values(changes).reduce((current, change) =>
    change.apply && (change.acceptedRevision === undefined || (confirmed.revision ?? 0) < change.acceptedRevision)
      ? change.apply(current) : current, confirmed), [confirmed, changes]);
  const statuses: Record<string, AutoSaveStatus> = Object.fromEntries(Array.from(new Set([...Object.keys(changes), ...Object.keys(errors)])).map((context) =>
    [context, errors[context] ? { state: "error", error: errors[context] } :
      active.some(([key]) => key === context) ? { state: "applying" } : { state: "idle" }]));

  const submit = async (context: string, type: CommandType, payload: unknown, apply?: Change["apply"]) => {
    const change: Change = { apply };
    latest.current[context] = change;
    setChanges((current) => ({ ...current, [context]: change }));
    setErrors((current) => ({ ...current, [context]: undefined }));
    try {
      const result = await appBridge.request(type, payload);
      if (latest.current[context] === change) {
        if (result.succeeded)
          setChanges((current) => ({ ...current, [context]: { ...change, acceptedRevision: result.configuration.revision ?? 0 } }));
        else {
          setChanges((current) => { const next = { ...current }; delete next[context]; return next; });
          setErrors((current) => ({ ...current, [context]: result.error ?? "更改未完成" }));
        }
      }
      return result.succeeded;
    } catch (error) {
      if (latest.current[context] === change) {
        setChanges((current) => { const next = { ...current }; delete next[context]; return next; });
        setErrors((current) => ({ ...current, [context]: String(error) }));
      }
      return false;
    }
  };

  const changeMapping = (agent: AgentTarget, mappings: Mappings) => {
    setUndo((current) => current?.agent === agent ? null : current);
    void submit(agent, "updateMapping", { agent, mappings }, (current) => ({ ...current,
      agentMappings: { ...current.agentMappings!, [agent]: mappings },
      mappings: (current.activeAgent ?? "codex") === agent ? mappings : current.mappings,
    }));
  };
  const changeSettings = (settings: SettingsValues) => {
    void submit("settings", "updateSettings", settings, (current) => ({ ...current, ...settings }));
  };
  const resetMapping = async (agent: AgentTarget, control?: string) => {
    const previous = configuration?.agentMappings?.[agent];
    const pending = submit(agent, "resetDefaults", { agent, ...(control ? { control } : {}) });
    const change = latest.current[agent];
    if (await pending && previous && latest.current[agent] === change) setUndo({ agent, mappings: previous });
  };
  return { configuration, statuses, persistenceError, changeMapping, changeSettings, resetMapping,
    undoResetAgent: undo?.agent, undoReset: undo ? () => changeMapping(undo.agent, undo.mappings) : undefined };
}
