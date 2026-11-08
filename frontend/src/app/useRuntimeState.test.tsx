import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostMessage, RuntimeConfiguration } from "./types";

const bridge = vi.hoisted(() => ({
  send: vi.fn(),
  subscribe: vi.fn<(listener: (message: HostMessage) => void) => () => void>(() => vi.fn()),
}));

vi.mock("./AppBridge", () => ({ appBridge: bridge }));

import { initialRuntimeState, useRuntimeState } from "./useRuntimeState";

const configuration: RuntimeConfiguration = {
  controllerType: "playStation5", activeControllerIndex: 2,
  codexOnly: true, dictationShortcut: "Ctrl+K", mouseSpeed: 60,
  scrollSpeed: 40, deadZone: 0.2, startWithWindows: false,
  mappings: { x: "send" },
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("useRuntimeState", () => {
  it("does not let an older queued configuration undo an accepted change", async () => {
    const { mergeRuntimeUpdate } = await import("./useRuntimeState");
    const current = { configuration: { ...configuration, revision: 2, mouseSpeed: 80 } };
    expect(mergeRuntimeUpdate(current, { configuration: { revision: 1, mouseSpeed: 40 } }).configuration?.mouseSpeed).toBe(80);
    expect(mergeRuntimeUpdate(current, { configuration: { scrollSpeed: 55 } }).configuration?.scrollSpeed).toBe(55);
  });

  it("requests the persisted runtime state after subscribing", () => {
    renderHook(() => useRuntimeState());

    expect(bridge.subscribe).toHaveBeenCalledOnce();
    expect(bridge.send).toHaveBeenCalledWith("requestState", {});
    expect(bridge.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      bridge.send.mock.invocationCallOrder[0],
    );
  });

  it("coalesces a burst into one frame without dropping earlier configuration changes", () => {
    let flush: FrameRequestCallback = () => {};
    const requestFrame = vi.spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => { flush = callback; return 42; });
    const { result } = renderHook(() => useRuntimeState());
    const receive = bridge.subscribe.mock.calls[0][0];
    act(() => {
      receive({ version: 1, type: "runtimeState",
        payload: { ...initialRuntimeState, configuration } });
      receive({ version: 1, type: "runtimeState",
        payload: { configuration: { mouseSpeed: 70 } } });
      receive({ version: 1, type: "runtimeState",
        payload: { packetNumber: 99, controls: { x: 1 }, configuration: null } });
    });
    expect(requestFrame).toHaveBeenCalledOnce();
    expect(result.current[0].packetNumber).toBe(0);
    act(() => flush(0));
    expect(result.current[0].packetNumber).toBe(99);
    expect(result.current[0].configuration).toEqual({ ...configuration, mouseSpeed: 70 });
    expect(result.current[0].controls).toEqual({ x: 1 });
    act(() => {
      receive({ version: 1, type: "runtimeState",
        payload: { configuration: { mappings: { a: "send" } } } });
      receive({ version: 1, type: "runtimeState",
        payload: { packetNumber: 100, controls: { x: 0 } } });
      flush(0);
    });
    expect(result.current[0].configuration).toEqual({
      ...configuration, mouseSpeed: 70, mappings: { a: "send" },
    });
    expect(result.current[0].configuration?.mappings).not.toHaveProperty("x");
    act(() => {
      receive({ version: 1, type: "runtimeState", payload: { configuration: { mappings: {} } } });
      flush(0);
    });
    expect(result.current[0].configuration?.mappings).toEqual({});
  });

  it("cancels a queued frame and unsubscribes on unmount", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const unsubscribe = vi.fn();
    bridge.subscribe.mockReturnValueOnce(unsubscribe);
    const { unmount } = renderHook(() => useRuntimeState());
    act(() => bridge.subscribe.mock.calls[0][0]({
      version: 1, type: "runtimeState", payload: { packetNumber: 12 },
    }));
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
