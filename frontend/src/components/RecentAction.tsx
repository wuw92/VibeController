import { AlertCircle, Check, Crosshair } from "lucide-react";
import type { RecentActionInfo, RuntimeConfiguration } from "../app/types";
import { getControllerPresentation } from "../app/controllerPresentation";
import { getMappingDisplay } from "../app/mappingActions";

interface RecentActionProps {
  action: string | null;
  recent?: RecentActionInfo | null;
  configuration?: RuntimeConfiguration;
}

export function RecentAction({ action, recent, configuration }: RecentActionProps) {
  const failed = recent?.status === "failed" || recent?.status === "blocked";
  const sent = recent?.status === "dispatched";
  const control = recent ? getControllerPresentation(recent.controllerType).controls.find((control) => control.key === recent.control)?.label ?? recent.control : null;
  const display = recent?.action ? getMappingDisplay(recent.action, configuration?.agentShortcuts?.[recent.agent]) : null;
  const title = recent ? `${control}${display ? ` → ${display.label}` : ""}` : action ?? "等待手柄输入";
  const note = recent ? sent ? "输入已发出" : recent.message ?? "未执行操作" : action ? "最近输入记录" : "按下任意已映射按键开始";
  return <div className="last-action" data-failed={failed}>
    <span className="action-icon" aria-hidden="true">{failed ? <AlertCircle size={18}/> : sent ? <Check size={18}/> : <Crosshair size={18}/>}</span>
    <div><strong>{title}</strong><p>{note}</p></div>
  </div>;
}
