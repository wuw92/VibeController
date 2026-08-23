import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  send: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}));

vi.mock("./AppBridge", () => ({ appBridge: bridge }));

import { useRuntimeState } from "./useRuntimeState";

describe("useRuntimeState", () => {
  it("requests the persisted runtime state after subscribing", () => {
    renderHook(() => useRuntimeState());

    expect(bridge.subscribe).toHaveBeenCalledOnce();
    expect(bridge.send).toHaveBeenCalledWith("requestState", {});
    expect(bridge.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      bridge.send.mock.invocationCallOrder[0],
    );
  });
});
