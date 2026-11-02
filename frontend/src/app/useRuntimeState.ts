import { useEffect, useState } from "react";
import { appBridge } from "./AppBridge";
import type { RuntimeConfiguration, RuntimeStatePayload, RuntimeStateUpdate } from "./types";

export const demoRuntimeState: RuntimeStatePayload = {
  connectionState: "connected",
  controllerIndex: 0,
  mappingEnabled: true,
  testMode: false,
  packetNumber: 12,
  controls: { x: 0, a: 0, b: 0, y: 0, leftStickX: 0, leftStickY: 0 },
  lastAction: "X → 切换听写快捷键",
};

export const initialRuntimeState: RuntimeStatePayload = {
  connectionState: "unknown",
  controllerIndex: 0,
  mappingEnabled: false,
  testMode: false,
  packetNumber: 0,
  controls: {},
  lastAction: null,
};

export function mergeRuntimeUpdate(
  current: RuntimeStateUpdate,
  update: RuntimeStateUpdate,
): RuntimeStateUpdate {
  const { configuration, ...runtime } = update;
  return {
    ...current,
    ...runtime,
    ...(configuration ? {
      configuration: { ...current.configuration, ...configuration },
    } : {}),
  };
}

export function useRuntimeState() {
  const [state, setState] = useState<RuntimeStatePayload>(
    new URLSearchParams(window.location.search).has("demo")
      ? demoRuntimeState
      : initialRuntimeState,
  );

  useEffect(() => {
    let pending: RuntimeStateUpdate | undefined;
    let frame: number | undefined;
    const unsubscribe = appBridge.subscribe((message) => {
      pending = mergeRuntimeUpdate(pending ?? {}, message.payload);
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        const update = pending!;
        pending = undefined;
        frame = undefined;
        setState((current) => {
          const merged = mergeRuntimeUpdate(current, update);
          return { ...current, ...merged,
            configuration: merged.configuration as RuntimeConfiguration | undefined };
        });
      });
    });
    appBridge.send("requestState", {});
    return () => {
      unsubscribe();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  return [state, setState] as const;
}
