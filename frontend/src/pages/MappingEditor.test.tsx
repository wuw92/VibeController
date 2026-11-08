import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { MappingEditor as HostMappingEditor } from "./MappingEditor";

// Explicit host fixture: production code never supplies these defaults.
const hostMappings = {
  x: "dictation", a: "send", b: "shortcut:Backspace", y: "commandPalette",
  leftShoulder: "previousChat", rightShoulder: "nextChat",
  dPadLeft: "decreaseReasoning", dPadRight: "increaseReasoning",
  rightStickLeft: "shortcut:ArrowLeft", rightStickRight: "shortcut:ArrowRight",
  rightStickUp: "shortcut:ArrowUp", rightStickDown: "shortcut:ArrowDown",
  touchpadX: "mouseMove", touchpadY: "mouseMove", touchpadButton: "mouseLeftClick",
  remoteOk: "send", remoteBack: "shortcut:Backspace", remoteHome: "activateCodex",
  remoteMenu: "commandPalette", remoteMic: "dictation",
  remoteLeft: "shortcut:ArrowLeft", remoteRight: "shortcut:ArrowRight",
  remotePower: "none", remoteInput: "none", remoteRed: "none",
  remoteGreen: "none", remoteBlue: "none", remoteSettings: "none",
  remoteApp1: "none", remoteApp2: "none", remoteBrightnessUp: "none",
  remoteBrightnessDown: "none", remotePictureMode: "none",
};

function MappingEditor(props: ComponentProps<typeof HostMappingEditor>) {
  return <HostMappingEditor initialValues={hostMappings} {...props} />;
}

afterEach(cleanup);

describe("MappingEditor", () => {
  it("shows Codex effective keys outside the operation menu and follows host updates", () => {
    const props = { onSave: vi.fn(), onReset: vi.fn(), initialValues: { x: "send" } };
    const { rerender } = render(<HostMappingEditor {...props} shortcutOptions={[
      { value: "send", label: "发送消息", shortcut: "Ctrl+Enter", source: "custom", message: null },
    ]} />);
    expect(screen.getByRole("option", { name: "发送消息" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ctrl|Enter/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前生效快捷键" })).toHaveTextContent("Ctrl+Enter");
    rerender(<HostMappingEditor {...props} shortcutOptions={[
      { value: "send", label: "发送消息", shortcut: "Ctrl+Shift+Enter", source: "custom", message: null },
    ]} />);
    expect(screen.getByRole("region", { name: "当前生效快捷键" })).toHaveTextContent("Ctrl+Shift+Enter");
  });

  it("applies an operation change automatically without save feedback", () => {
    const onSave = vi.fn();
    render(<HostMappingEditor initialValues={{ x: "dictation" }} onSave={onSave} onReset={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "send" } });
    expect(onSave).toHaveBeenLastCalledWith({ x: "send" });
    expect(screen.queryByRole("button", { name: "保存映射" })).not.toBeInTheDocument();
    expect(screen.queryByText(/正在保存|已保存|正在应用/)).not.toBeInTheDocument();
  });

  it("only applies a custom binding after a complete key is recorded", () => {
    const onSave = vi.fn();
    render(<HostMappingEditor initialValues={{ x: "send" }} onSave={onSave} onReset={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "keyboardShortcut" } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText("自定义快捷键"), { key: "K", ctrlKey: true });
    expect(onSave).toHaveBeenLastCalledWith({ x: "shortcut:Ctrl+K" });
  });

  it("does not replace newer edits while their change is being processed", () => {
    const props = { onSave: vi.fn(), onReset: vi.fn() };
    const { rerender } = render(<HostMappingEditor {...props} initialValues={{ x: "dictation" }} />);
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "send" } });
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "commandPalette" } });
    rerender(<HostMappingEditor {...props} initialValues={{ x: "send" }} saveStatus={{ state: "applying" }} />);
    expect(screen.getByLabelText("绑定操作")).toHaveValue("commandPalette");
    expect(props.onSave).toHaveBeenLastCalledWith({ x: "commandPalette" });
  });

  it("waits for host configuration before enabling edits", () => {
    const onSave = vi.fn();
    render(<HostMappingEditor onSave={onSave} onReset={vi.fn()} />);
    expect(screen.getByLabelText("绑定操作")).toBeDisabled();
    expect(screen.getByRole("button", { name: "恢复默认" })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows real application errors without a normal saving workflow", () => {
    render(<HostMappingEditor initialValues={{ x: "send" }} onSave={vi.fn()} onReset={vi.fn()}
      saveStatus={{ state: "error", error: "无效快捷键" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("无效快捷键");
  });

  it("warns when two controls use the same exclusive shortcut", () => {
    render(<MappingEditor onSave={vi.fn()} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Y 按键" }));
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "dictation" } });

    expect(screen.getByRole("alert")).toHaveTextContent("与 X 按键冲突");
  });

  it("can reset the default profile", () => {
    const onReset = vi.fn();
    render(<MappingEditor onSave={vi.fn()} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("records a custom keyboard shortcut", () => {
    const onSave = vi.fn();
    render(<MappingEditor onSave={onSave} onReset={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "keyboardShortcut" } });
    fireEvent.keyDown(screen.getByLabelText("自定义快捷键"), { key: "K", ctrlKey: true, shiftKey: true });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ x: "shortcut:Ctrl+Shift+K" }));
  });

  it("uses the text-editing defaults and keeps cancel available as an optional action", () => {
    const onSave = vi.fn();
    render(<MappingEditor onSave={onSave} onReset={vi.fn()} />);

    expect(screen.getByRole("button", { name: "右摇杆左" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "右摇杆右" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "右摇杆上" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "右摇杆下" })).toBeInTheDocument();

    expect(screen.queryByRole("option", { name: "上一个模型" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "下一个模型" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "取消 / 返回" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "dictation" } });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      b: "shortcut:Backspace",
      dPadLeft: "decreaseReasoning",
      dPadRight: "increaseReasoning",
      rightStickLeft: "shortcut:ArrowLeft",
      rightStickRight: "shortcut:ArrowRight",
      rightStickUp: "shortcut:ArrowUp",
      rightStickDown: "shortcut:ArrowDown",
    }));
  });

  it("shows Codex-native actions with the names used by Codex shortcut settings", () => {
    render(<MappingEditor onSave={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getByRole("option", { name: "切换听写快捷键" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "发送消息" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "打开命令菜单" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "上一个任务" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "下一项任务" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "降低推理强度" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "提高推理强度" })).toBeInTheDocument();
  });

  it("explains automatic Codex shortcut lookup only for Codex semantic actions", () => {
    render(<MappingEditor onSave={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getByText("由 Codex 管理，设置变化后自动同步。")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "keyboardShortcut" } });

    expect(screen.queryByText("由 Codex 管理，设置变化后自动同步。")).not.toBeInTheDocument();
  });

  it("offers recent-task and tab navigation without changing the default bindings", () => {
    const onSave = vi.fn();
    render(<MappingEditor onSave={onSave} onReset={vi.fn()} />);

    expect(screen.getByRole("option", { name: "上一个最近查看的任务" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "下一个最近查看的任务" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "上一个标签页" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "下一个标签页" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "dictation" } });

    const saved = onSave.mock.calls.at(-1)![0] as Record<string, string>;
    expect(saved.leftShoulder).toBe("previousChat");
    expect(saved.rightShoulder).toBe("nextChat");
    expect(Object.values(saved)).not.toContain("previousRecentThread");
    expect(Object.values(saved)).not.toContain("nextRecentThread");
    expect(Object.values(saved)).not.toContain("previousTab");
    expect(Object.values(saved)).not.toContain("nextTab");
  });

  it("uses PlayStation symbols, shoulder names and touchpad controls for PS5", () => {
    const onSave = vi.fn();
    render(
      <MappingEditor
        controllerType="playStation5"
        onSave={onSave}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "□ 方块键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "× 叉键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "○ 圆圈键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "△ 三角键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "L1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "R1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "L2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "R2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "触控板横向滑动" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "触控板纵向滑动" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "触控板按下" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "dictation" } });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      touchpadX: "mouseMove",
      touchpadY: "mouseMove",
      touchpadButton: "mouseLeftClick",
    }));
  });

  it("uses neutral remote controls and RC901A defaults for TCL", () => {
    const onSave = vi.fn();
    render(
      <MappingEditor
        controllerType="tclRc901a"
        onSave={onSave}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "确认键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "主页键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "麦克风键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "音量 +" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "电源键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "输入源键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "红色键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "绿色键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "蓝色键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设置键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bilibili 键" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "奇异果 TV 键" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "爱奇艺键" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "频道 +" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "数字键 0" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "麦克风键" }));
    fireEvent.change(screen.getByLabelText("绑定操作"), { target: { value: "dictation" } });

    const saved = onSave.mock.calls.at(-1)![0] as Record<string, string>;
    expect(saved).toEqual(expect.objectContaining({
      remoteOk: "send",
      remoteBack: "shortcut:Backspace",
      remoteHome: "activateCodex",
      remoteMenu: "commandPalette",
      remoteMic: "dictation",
      remoteLeft: "shortcut:ArrowLeft",
      remoteRight: "shortcut:ArrowRight",
      remotePower: "none",
      remoteInput: "none",
      remoteRed: "none",
      remoteGreen: "none",
      remoteBlue: "none",
      remoteSettings: "none",
      remoteApp1: "none",
      remoteApp2: "none",
      remoteBrightnessUp: "none",
      remoteBrightnessDown: "none",
      remotePictureMode: "none",
    }));
    expect(screen.getByRole("button", { name: "亮度 +" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "亮度 −" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图像模式" })).toBeInTheDocument();
    expect(saved).not.toHaveProperty("remoteChannelUp");
    expect(saved).not.toHaveProperty("remoteDigit0");
  });
});
