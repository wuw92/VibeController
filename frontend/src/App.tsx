import { useEffect, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import type { AppPage } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { AgentMappingEditor } from "./pages/AgentMappingEditor";
import { Settings } from "./pages/Settings";
import { appBridge } from "./app/AppBridge";
import { useRuntimeState } from "./app/useRuntimeState";
import type { AgentTarget, AutoSaveStatus, CommandType } from "./app/types";
import type { MappingValues } from "./pages/MappingEditor";
import type { SettingsValues } from "./pages/Settings";

export default function App() {
  const [state, setState] = useRuntimeState();
  const [page, setPage] = useState<AppPage>("dashboard");
  const [saveStatus, setSaveStatus] = useState<Record<string, AutoSaveStatus>>({});
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  useEffect(() => appBridge.subscribe((message) => {
    if (message.type === "settingsPersistence") setPersistenceError(message.payload.error);
  }), []);
  const revision = useRef(0);
  const latest = useRef<Record<string, number>>({});

  const applyConfiguration = async (context: string, type: CommandType, payload: unknown) => {
    const previous = state.configuration;
    const current = ++revision.current;
    latest.current[context] = current;
    setSaveStatus((status) => ({ ...status, [context]: { state: "applying" } }));
    try {
      const result = await appBridge.request(type, payload);
      if (current === revision.current)
        setState((state) => ({ ...state, configuration: result.configuration }));
      if (latest.current[context] === current)
        setSaveStatus((status) => ({ ...status, [context]: result.succeeded
          ? { state: "idle" } : { state: "error", error: result.error ?? "请重试" } }));
    } catch (error) {
      if (current === revision.current && previous)
        setState((state) => ({ ...state, configuration: previous }));
      if (latest.current[context] === current)
        setSaveStatus((status) => ({ ...status, [context]: { state: "error", error: String(error) } }));
    }
  };

  const changeMapping = (agent: AgentTarget, mappings: MappingValues) => {
    setState((state) => ({ ...state, configuration: state.configuration ? {
      ...state.configuration,
      revision: Number.POSITIVE_INFINITY,
      agentMappings: { ...state.configuration.agentMappings!, [agent]: mappings },
      mappings: (state.configuration.activeAgent ?? "codex") === agent ? mappings : state.configuration.mappings,
    } : undefined }));
    void applyConfiguration(agent, "updateMapping", { agent, mappings });
  };

  const changeSettings = (settings: SettingsValues) => {
    setState((state) => ({ ...state, configuration: state.configuration ? {
      ...state.configuration, ...settings, revision: Number.POSITIVE_INFINITY, controllerType: state.configuration.controllerType,
    } : undefined }));
    void applyConfiguration("settings", "updateSettings", settings);
  };

  const toggleMapping = (enabled: boolean) => {
    setState((current) => ({ ...current, mappingEnabled: enabled }));
    appBridge.send("setMappingEnabled", { enabled });
  };

  const toggleTestMode = (enabled: boolean) => {
    setState((current) => ({ ...current, testMode: enabled }));
    appBridge.send("setTestMode", { enabled });
  };

  return (
    <AppShell page={page} onNavigate={setPage}>
      {persistenceError && <p className="configuration-persistence-error" role="alert">更改已生效，但未能自动保存：{persistenceError}</p>}
      {page === "dashboard" && <Dashboard state={state} onToggleMapping={toggleMapping} onToggleTestMode={toggleTestMode} />}
      {page === "mapping" && (
        <AgentMappingEditor
          configuration={state.configuration}
          saveStatus={saveStatus}
          onSave={changeMapping}
          onReset={(agent) => { void applyConfiguration(agent, "resetDefaults", { agent }); }}
        />
      )}
      {page === "settings" && (
        <Settings
          saveStatus={saveStatus.settings}
          initialValues={state.configuration ? {
            controllerType: state.configuration.controllerType,
            activeControllerIndex: state.configuration.activeControllerIndex,
            codexOnly: state.configuration.codexOnly,
            dictationShortcut: state.configuration.dictationShortcut,
            mouseSpeed: Math.round(state.configuration.mouseSpeed),
            scrollSpeed: Math.round(state.configuration.scrollSpeed),
            deadZone: state.configuration.deadZone,
            startWithWindows: state.configuration.startWithWindows,
            codexLightbarEnabled: state.configuration.codexLightbarEnabled ?? false,
          } : undefined}
          microphone={state.configuration?.microphone}
          codexHook={state.configuration?.codexHook}
          codexActivity={state.configuration?.codexActivity}
          rc901a={state.configuration?.rc901a}
          rc901aInput={state.configuration?.rc901aInput}
          persistedControllerType={state.configuration?.controllerType}
          rc901aLearningReady={
            state.configuration?.rc901a?.connectionState === "connected" ||
            state.configuration?.rc901a?.connectionState === "connectedLimited"
          }
          onSave={changeSettings}
          onRefreshIntegrations={() => appBridge.send("refreshIntegrations", {})}
          onRefreshRc901a={() => appBridge.send("refreshRc901a", {})}
          onClearRc901aSamples={() => appBridge.send("clearRc901aSamples", {})}
          onStartRc901aLearning={(control, compatibilityOverride) =>
            appBridge.send("startRc901aLearning", {
              control,
              compatibilityOverride,
            })
          }
          onConfirmRc901aLearning={(sessionId) => appBridge.send("confirmRc901aLearning", { sessionId })}
          onRetryRc901aLearning={(sessionId) => appBridge.send("retryRc901aLearning", { sessionId })}
          onCancelRc901aLearning={(sessionId) => appBridge.send("cancelRc901aLearning", { sessionId })}
          onResetRc901aLearnedBindings={() => appBridge.send("resetRc901aLearnedBindings", {})}
          onCopyDiagnostics={() => {
            void navigator.clipboard?.writeText(JSON.stringify({ version: "0.1.0", runtime: state }, null, 2));
            appBridge.send("requestState", { copyDiagnostics: true });
          }}
        />
      )}
    </AppShell>
  );
}
