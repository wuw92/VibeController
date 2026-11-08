import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RecentAction } from "./RecentAction";
import type { RecentActionInfo } from "../app/types";

afterEach(cleanup);
const recent: RecentActionInfo = { control: "x", action: "shortcut:F8", status: "dispatched",
  message: "输入已发出", agent: "codex", controllerType: "xbox" };

it("describes the actual mapping instead of the factory default", () => {
  render(<RecentAction action={null} recent={recent} />);
  expect(screen.getByText("X 按键 → 键盘：F8")).toBeInTheDocument();
  expect(screen.getByText("输入已发出")).toBeInTheDocument();
  expect(screen.queryByText(/听写/)).not.toBeInTheDocument();
});

it("does not claim an input was dispatched in test mode", () => {
  render(<RecentAction action={null} recent={{ ...recent, action: null, status: "test", message: "仅检测输入，未执行操作" }} />);
  expect(screen.getByText("仅检测输入，未执行操作")).toBeInTheDocument();
  expect(screen.queryByText("输入已发出")).not.toBeInTheDocument();
});
