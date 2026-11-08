import { useState } from "react";
import { AppShell } from "./components/AppShell";
import type { AppPage } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { AgentMappingEditor } from "./pages/AgentMappingEditor";
import { Settings } from "./pages/Settings";
import { appBridge } from "./app/AppBridge";
import { useRuntimeState } from "./app/useRuntimeState";
import { useConfigurationChanges } from "./app/useConfigurationChanges";

export default function App() {
  const [state, setState] = useRuntimeState();
  const [page, setPage] = useState<AppPage>("dashboard");
  const { configuration, statuses, persistenceError, changeMapping, changeSettings, resetMapping,
    undoResetAgent, undoReset } = useConfigurationChanges(state.configuration);

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
      {page === "dashboard" && <Dashboard state={{ ...state, configuration }} onToggleMapping={toggleMapping} onToggleTestMode={toggleTestMode} onOpenMappings={() => setPage("mapping")} />}
      {page === "mapping" && (
        <AgentMappingEditor
          configuration={configuration}
          saveStatus={statuses}
          onSave={changeMapping}
          onReset={(agent, control) => { void resetMapping(agent, control); }}
          undoResetAgent={undoResetAgent}
          onUndoReset={undoReset}
        />
      )}
      {page === "settings" && (
        <Settings
          saveStatus={statuses.settings}
          initialValues={configuration ? {
            controllerType: configuration.controllerType,
            activeControllerIndex: configuration.activeControllerIndex,
            codexOnly: configuration.codexOnly,
            dictationShortcut: configuration.dictationShortcut,
            mouseSpeed: Math.round(configuration.mouseSpeed),
            scrollSpeed: Math.round(configuration.scrollSpeed),
            deadZone: configuration.deadZone,
            startWithWindows: configuration.startWithWindows,
            codexLightbarEnabled: configuration.codexLightbarEnabled ?? false,
          } : undefined}
          microphone={configuration?.microphone}
          codexHook={configuration?.codexHook}
          codexActivity={configuration?.codexActivity}
          rc901a={configuration?.rc901a}
          rc901aInput={configuration?.rc901aInput}
          persistedControllerType={state.configuration?.controllerType}
          rc901aLearningReady={
            configuration?.rc901a?.connectionState === "connected" ||
            configuration?.rc901a?.connectionState === "connectedLimited"
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
