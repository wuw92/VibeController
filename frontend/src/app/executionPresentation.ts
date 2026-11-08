import type { RuntimeStatePayload } from "./types";

export function executionPresentation(state: RuntimeStatePayload) {
  if (state.connectionState !== "connected") return { label: "等待设备连接", tone: "warning" as const };
  if (state.testMode) return { label: "测试中：仅检测输入", tone: "warning" as const };
  if (!state.mappingEnabled) return { label: "映射已暂停", tone: "warning" as const };
  if (!state.configuration) return { label: "等待配置", tone: "warning" as const };
  if (state.configuration.codexOnly && !state.configuration.foregroundAgent)
    return { label: "等待目标应用", tone: "info" as const };
  return { label: "映射可执行", tone: "success" as const };
}
