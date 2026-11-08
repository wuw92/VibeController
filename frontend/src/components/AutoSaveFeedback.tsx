import type { AutoSaveStatus } from "../app/types";

export function AutoSaveFeedback({ status }: { status?: AutoSaveStatus }) {
  if (status?.state !== "error") return null;
  return <span className="mapping-save-status" data-state="error" role="alert">
    更改未完成：{status.error ?? "请重试"}
  </span>;
}
