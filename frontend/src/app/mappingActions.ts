import type { AgentShortcutOption } from "./types";

export const actionOptions = [
  ["dictation", "切换听写快捷键"],
  ["send", "发送消息"],
  ["cancel", "取消 / 返回"],
  ["commandPalette", "打开命令菜单"],
  ["previousChat", "上一个任务"],
  ["nextChat", "下一项任务"],
  ["previousRecentThread", "上一个最近查看的任务"],
  ["nextRecentThread", "下一个最近查看的任务"],
  ["previousTab", "上一个标签页"],
  ["nextTab", "下一个标签页"],
  ["increaseReasoning", "提高推理强度"],
  ["decreaseReasoning", "降低推理强度"],
  ["activateCodex", "激活 Codex 窗口"],
  ["activateDeepSeekHarness", "激活 DeepSeek Harness 窗口"],
  ["keyboardShortcut", "键盘快捷键"],
  ["mouseMove", "鼠标：移动"],
  ["mouseLeftClick", "鼠标：左键单击"],
  ["mouseRightClick", "鼠标：右键单击"],
  ["mouseScrollUp", "鼠标：滚轮向上"],
  ["mouseScrollDown", "鼠标：滚轮向下"],
  ["none", "不执行操作"],
] as const;

export const codexShortcutActions = new Set([
  "dictation", "send", "commandPalette", "previousChat", "nextChat",
  "previousRecentThread", "nextRecentThread", "previousTab", "nextTab",
  "increaseReasoning", "decreaseReasoning",
]);

const labels = new Map<string, string>(actionOptions);

export function getMappingDisplay(value: string | undefined, shortcuts?: AgentShortcutOption[]) {
  if (value?.startsWith("shortcut:")) {
    const key = value.slice(9);
    const readable = ({ Backspace: "Backspace（删除上一个字符）", ArrowUp: "↑（ArrowUp）",
      ArrowDown: "↓（ArrowDown）", ArrowLeft: "←（ArrowLeft）", ArrowRight: "→（ArrowRight）" } as Record<string, string>)[key] ?? key;
    return { label: key ? `键盘：${readable}` : "键盘：请录入快捷键", shortcut: key,
      source: "custom" as const, message: null };
  }
  const command = shortcuts?.find((option) => option.value === value);
  if (command) return { ...command, label: labels.get(value!) ?? command.label };
  if (value === "cancel") return { label: labels.get(value)!, shortcut: "Esc", source: "fixed" as const, message: null };
  return { label: labels.get(value ?? "") ?? "未设置", shortcut: null, source: undefined,
    message: null };
}
