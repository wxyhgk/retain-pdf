export {
  isJobTerminal,
  isTerminalStatus,
} from "../../job/core.js";

export function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function normalizeRuntimeDisplayStage(value = "") {
  const stage = `${value || ""}`.trim().toLowerCase();
  if (stage === "translation" || stage === "translating") {
    return "translate";
  }
  return stage;
}

// Backends sometimes flip display_stage / stage_snapshot.publicStage to "done"
// (or set pdf_ready before the run actually reaches a terminal status). Without
// this guard the recent-jobs card label would jump from "Đang render" straight to
// "Đã hoàn tất" while the job is still running. Clamp "done" back to "render"
// unless the job's own status says it's truly succeeded.
export function clampRuntimeStageKeyForJob(stageKey = "", jobOrStatus: any = {}) {
  if (`${stageKey || ""}`.trim() !== "done") {
    return stageKey;
  }
  const status = typeof jobOrStatus === "string"
    ? jobOrStatus
    : jobOrStatus?.status;
  if (`${status || ""}`.trim().toLowerCase() === "succeeded") {
    return stageKey;
  }
  return "render";
}
