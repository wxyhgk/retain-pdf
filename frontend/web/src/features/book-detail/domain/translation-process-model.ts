// 翻译流水线模型（纯逻辑）：从 job/item 派生 OCR→翻译→渲染→完成 四站状态。
// 供 ProcessingPipelineRail 消费；不含 React，可被非 React 宿主复用。

import type { LibraryCardItem } from "@/features/library/domain.js";
import { translationUsesReusedOcr } from "@/features/library/domain.js";
import { percentFromProgress } from "./progress-value.js";
import { isActiveJobStatus } from "@retainpdf/domain/job";

const PROCESS_STAGES = [
  { key: "ocr", label: "OCR" },
  { key: "translate", label: "翻译" },
  { key: "render", label: "渲染" },
  { key: "done", label: "完成" },
] as const;

type ProcessStageKey = typeof PROCESS_STAGES[number]["key"];
type ProcessStepState = "pending" | "active" | "done" | "failed" | "cancelled";

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function normalizedStage(value: unknown): ProcessStageKey | "" {
  switch (text(value).toLowerCase()) {
    case "ocr":
    case "ocr_processing":
      return "ocr";
    case "translate":
    case "translation":
    case "translating":
      return "translate";
    case "render":
    case "rendering":
      return "render";
    case "done":
    case "finished":
      return "done";
    default:
      return "";
  }
}

function stageFromItem(item: LibraryCardItem): ProcessStageKey | "" {
  const status = text(item.status).toLowerCase();
  if (status === "succeeded") return "done";
  const snapshot = (item.stage_snapshot || {}) as Record<string, unknown>;
  const runtime = (item.runtime_status || {}) as Record<string, unknown>;
  return normalizedStage(item.display_stage)
    || normalizedStage(snapshot.publicStage)
    || normalizedStage(snapshot.public_stage)
    || normalizedStage(snapshot.stageKey)
    || normalizedStage(snapshot.display_stage)
    || normalizedStage(runtime.publicStage)
    || normalizedStage(runtime.stageKey);
}

function progressFromItem(item: LibraryCardItem): number | null {
  const snapshot = (item.stage_snapshot || {}) as Record<string, unknown>;
  const snapshotProgress = snapshot.progress && typeof snapshot.progress === "object"
    ? snapshot.progress as Record<string, unknown>
    : {};
  const progress = Object.keys(snapshotProgress).length
    ? snapshotProgress
    : item.progress && typeof item.progress === "object"
      ? item.progress as Record<string, unknown>
      : {};
  return percentFromProgress(progress);
}

function backendStageState(item: LibraryCardItem, key: "ocr" | "translation" | "render"): string {
  const stages = item.stages && typeof item.stages === "object"
    ? item.stages as Record<string, unknown>
    : {};
  const stage = stages[key] && typeof stages[key] === "object"
    ? stages[key] as Record<string, unknown>
    : {};
  return text(stage.state).toLowerCase();
}

function processStateFromBackend(state: string): ProcessStepState | null {
  if (state === "reused" || state === "completed") return "done";
  if (state === "queued" || state === "in_progress") return "active";
  if (state === "failed") return "failed";
  if (state === "pending" || state === "skipped") return "pending";
  return null;
}

function succeededStatus(status: string): boolean {
  return status === "succeeded";
}

export function translationProcessModel(item: LibraryCardItem = {}) {
  const status = text(item.status).toLowerCase();
  const ocrReused = translationUsesReusedOcr(item);
  const derivedStage = stageFromItem(item);
  const backendStates = {
    ocr: backendStageState(item, "ocr"),
    translate: backendStageState(item, "translation"),
    render: backendStageState(item, "render"),
  };
  const backendCurrentStage = (["ocr", "translate", "render"] as const).find((key) =>
    ["queued", "in_progress", "failed"].includes(backendStates[key])) || "";
  const currentStage = succeededStatus(status)
    ? "done"
    : backendCurrentStage
      || (ocrReused && !derivedStage && isActiveJobStatus(status)
        ? "translate"
        : derivedStage);
  const currentIndex = PROCESS_STAGES.findIndex((stage) => stage.key === currentStage);
  const failed = status === "failed";
  const cancelled = status === "cancelled" || status === "canceled";
  const succeeded = status === "succeeded";
  const active = status === "queued" || status === "pending" || status === "running";

  const steps = PROCESS_STAGES.map((stage, index): typeof stage & { state: ProcessStepState } => {
    let state: ProcessStepState = "pending";
    const backendState = stage.key === "done"
      ? null
      : processStateFromBackend(backendStates[stage.key]);
    if (succeeded) state = "done";
    else if (backendState) state = backendState;
    else if (ocrReused && stage.key === "ocr") state = "done";
    else if (currentIndex >= 0 && index < currentIndex) state = "done";
    else if (currentIndex >= 0 && index === currentIndex) {
      state = failed ? "failed" : cancelled ? "cancelled" : active ? "active" : "pending";
    }
    return { ...stage, state };
  });

  const snapshot = (item.stage_snapshot || {}) as Record<string, unknown>;
  const detail = text(snapshot.stage_detail || item.stage_detail);
  return {
    currentStage,
    progress: progressFromItem(item),
    status,
    steps,
    detail,
    ocrReused,
  };
}
