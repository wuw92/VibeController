import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CommandResult, RuntimeConfiguration } from "./types";

const bridge = vi.hoisted(() => ({ request: vi.fn(), subscribe: vi.fn(() => () => {}) }));
vi.mock("./AppBridge", () => ({ appBridge: bridge }));
import { useConfigurationChanges } from "./useConfigurationChanges";

const confirmed: RuntimeConfiguration = { revision: 0, controllerType: "xbox", activeControllerIndex: 0,
  codexOnly: true, dictationShortcut: "F12", mouseSpeed: 50, scrollSpeed: 50, deadZone: .12,
  startWithWindows: false, mappings: { x: "dictation" },
  agentMappings: { codex: { x: "dictation" }, deepSeekHarness: { x: "none" } } };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("preserves an accepted change and later host refresh after another request fails", async () => {
  let acceptFirst: (value: CommandResult) => void = () => {};
  bridge.request.mockImplementationOnce(() => new Promise((resolve) => { acceptFirst = resolve; }))
    .mockRejectedValueOnce(new Error("transport_closed"));
  const { result, rerender } = renderHook(({ configuration }) => useConfigurationChanges(configuration),
    { initialProps: { configuration: confirmed } });
  act(() => {
    result.current.changeSettings({ ...confirmed, mouseSpeed: 80, codexLightbarEnabled: false });
    result.current.changeMapping("deepSeekHarness", { x: "send" });
  });
  await act(async () => {});
  const accepted = { ...confirmed, revision: 1, mouseSpeed: 80 };
  await act(async () => { acceptFirst({ requestId: "first", succeeded: true, configuration: accepted, error: null }); });
  rerender({ configuration: accepted });
  expect(result.current.configuration?.mouseSpeed).toBe(80);
  expect(result.current.configuration?.agentMappings?.deepSeekHarness.x).toBe("none");
  expect(result.current.statuses.deepSeekHarness.state).toBe("error");
  const refreshed = { ...accepted, revision: 2, foregroundAgent: "deepSeekHarness" as const };
  rerender({ configuration: refreshed });
  expect(result.current.configuration?.foregroundAgent).toBe("deepSeekHarness");
  expect(result.current.configuration?.revision).toBe(2);
});

it("keeps the newest choice when an older response arrives in the same context", async () => {
  const replies: ((result: CommandResult) => void)[] = [];
  bridge.request.mockImplementation(() => new Promise((resolve) => replies.push(resolve)));
  const { result } = renderHook(() => useConfigurationChanges(confirmed));
  act(() => { result.current.changeMapping("codex", { x: "send" }); result.current.changeMapping("codex", { x: "none" }); });
  await act(async () => replies[0]({ requestId: "old", succeeded: true, configuration: { ...confirmed, revision: 1 }, error: null }));
  expect(result.current.configuration?.agentMappings?.codex.x).toBe("none");
  expect(result.current.statuses.codex.state).toBe("applying");
});

it("can undo a scoped reset without changing the other agent", async () => {
  bridge.request.mockResolvedValue({ requestId: "reset", succeeded: true, configuration: { ...confirmed, revision: 1 }, error: null });
  const { result } = renderHook(() => useConfigurationChanges(confirmed));
  await act(async () => { await result.current.resetMapping("codex", "x"); });
  expect(result.current.undoResetAgent).toBe("codex");
  act(() => { result.current.undoReset?.(); });
  expect(bridge.request).toHaveBeenLastCalledWith("updateMapping", { agent: "codex", mappings: { x: "dictation" } });
});
