import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RuntimeConfiguration } from "../app/types";
import { AgentMappingEditor } from "./AgentMappingEditor";

afterEach(cleanup);

const configuration: RuntimeConfiguration = {
  controllerType: "xbox", activeControllerIndex: 0, codexOnly: true,
  dictationShortcut: "F12", mouseSpeed: 50, scrollSpeed: 50, deadZone: 0.12,
  startWithWindows: false, mappings: { x: "dictation" },
  agentMappings: { codex: { x: "dictation" }, deepSeekHarness: { x: "shortcut:Ctrl+J" } },
};

it("saves and resets the chosen agent and preserves both drafts while switching", () => {
  const onSave = vi.fn();
  const onReset = vi.fn();
  const { rerender } = render(<AgentMappingEditor configuration={configuration} onSave={onSave} onReset={onReset} />);
  fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "send" } });
  fireEvent.change(screen.getByRole("combobox", { name: "配置 Agent" }), { target: { value: "deepSeekHarness" } });
  const deepSeek = within(screen.getByRole("group", { name: "deepSeekHarness 映射" }));
  expect(deepSeek.queryByRole("option", { name: "切换听写快捷键" })).not.toBeInTheDocument();
  fireEvent.keyDown(deepSeek.getByLabelText("自定义快捷键"), { key: "K", ctrlKey: true });
  expect(onSave).toHaveBeenLastCalledWith("deepSeekHarness", { x: "shortcut:Ctrl+K" });
  fireEvent.change(screen.getByRole("combobox", { name: "配置 Agent" }), { target: { value: "codex" } });
  const codex = within(screen.getByRole("group", { name: "codex 映射" }));
  expect(codex.getByLabelText("绑定操作")).toHaveValue("send");
  expect(onSave).toHaveBeenCalledWith("codex", { x: "send" });
  fireEvent.change(screen.getByRole("combobox", { name: "配置 Agent" }), { target: { value: "deepSeekHarness" } });
  fireEvent.click(deepSeek.getByRole("button", { name: /重置.*全部映射/ }));
  expect(onReset).toHaveBeenLastCalledWith("deepSeekHarness");
  rerender(<AgentMappingEditor configuration={{ ...configuration,
    agentMappings: { codex: { x: "send" }, deepSeekHarness: { x: "none" } },
  }} onSave={onSave} onReset={onReset} />);
  expect(deepSeek.getByLabelText("绑定操作")).toHaveValue("none");
});

it("explains that global mode uses Codex even while editing DeepSeek Harness", () => {
  render(<AgentMappingEditor configuration={{ ...configuration, codexOnly: false }} onSave={vi.fn()} onReset={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "配置 Agent" }), { target: { value: "deepSeekHarness" } });
  expect(within(screen.getByRole("group", { name: "deepSeekHarness 映射" })).getByText("全局模式：始终使用 Codex 映射。")).toBeInTheDocument();
});

it("shows current DSH keys outside the menu and synchronizes without discarding the draft", () => {
  const onSave = vi.fn();
  const dsh = [
    { value: "deepseek:fixed.send", label: "发送消息", shortcut: "Enter", source: "fixed" as const, message: null },
    { value: "deepseek:session.search", label: "搜索任务", shortcut: "Ctrl+K", source: "default" as const, message: null },
  ];
  const loaded: RuntimeConfiguration = { ...configuration, agentShortcuts: { codex: [], deepSeekHarness: dsh } };
  const { rerender } = render(<AgentMappingEditor configuration={loaded} onSave={onSave} onReset={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "配置 Agent" }), { target: { value: "deepSeekHarness" } });
  const editor = within(screen.getByRole("group", { name: "deepSeekHarness 映射" }));
  expect(editor.getByRole("option", { name: "发送消息" })).toBeInTheDocument();
  expect(editor.queryByRole("option", { name: /Enter|Ctrl/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /刷新/ })).not.toBeInTheDocument();
  fireEvent.change(editor.getByLabelText("绑定操作"), { target: { value: "deepseek:session.search" } });
  expect(within(editor.getByRole("region", { name: "当前生效快捷键" })).getByText("Ctrl+K")).toBeInTheDocument();
  rerender(<AgentMappingEditor configuration={{ ...loaded, agentShortcuts: {
    codex: [], deepSeekHarness: [dsh[0], { ...dsh[1], shortcut: "Ctrl+J", source: "custom" }],
  } }} onSave={onSave} onReset={vi.fn()} />);
  expect(editor.getByLabelText("绑定操作")).toHaveValue("deepseek:session.search");
  expect(within(editor.getByRole("region", { name: "当前生效快捷键" })).getByText("Ctrl+J")).toBeInTheDocument();
  expect(editor.getByText("由 DeepSeek Harness 管理，设置变化后自动同步。")).toBeInTheDocument();
  expect(onSave).toHaveBeenLastCalledWith("deepSeekHarness", { x: "deepseek:session.search" });
});
