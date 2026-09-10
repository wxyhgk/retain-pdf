import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";

import type { LibraryCardItem } from "@/features/library/domain.js";
import { translationUsesReusedOcr } from "@/features/library/domain.js";

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
  const percent = Number(progress.percent);
  if (Number.isFinite(percent)) return Math.max(0, Math.min(100, percent));
  const current = Number(progress.current);
  const total = Number(progress.total);
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, (current / total) * 100));
  }
  return null;
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
      || (ocrReused && !derivedStage && ["queued", "pending", "running"].includes(status)
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

function succeededStatus(status: string): boolean {
  return status === "succeeded";
}

function StepIcon({ state }: { state: ProcessStepState }) {
  if (state === "done") return <Check className="size-3" aria-hidden="true" />;
  if (state === "active") return <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />;
  if (state === "failed") return <TriangleAlert className="size-3" aria-hidden="true" />;
  if (state === "cancelled") return <X className="size-3" aria-hidden="true" />;
  return <span className="size-1.5 rounded-full bg-current opacity-35" aria-hidden="true" />;
}

export function TranslationProcessOverview({ item = {} }: { item?: LibraryCardItem }) {
  const model = translationProcessModel(item);
  const jobId = text(item.job_id || item.active_job_id);
  if (!jobId || jobId.startsWith("doc:")) return null;

  return (
    <section
      className="translation-process-overview book-detail-translation-process"
      aria-label="翻译处理过程"
      data-translation-process="true"
      data-job-id={jobId}
      data-current-stage={model.currentStage}
      data-status={model.status}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-muted-foreground">处理过程</span>
        {model.progress !== null && model.status !== "succeeded" ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {Math.round(model.progress)}%
          </span>
        ) : null}
      </div>
      <ol className="grid grid-cols-4 gap-1.5" aria-label="OCR、翻译、渲染、完成">
        {model.steps.map((step) => (
          <li
            key={step.key}
            className={`translation-process-step flex min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-[11px] font-medium ${
              step.state === "done"
                ? "border-foreground/10 bg-foreground/8 text-foreground"
                : step.state === "active"
                  ? "border-foreground/20 bg-foreground text-background"
                  : step.state === "failed"
                    ? "border-foreground/35 bg-background text-foreground"
                    : step.state === "cancelled"
                      ? "border-border bg-muted text-muted-foreground"
                      : "border-border/70 bg-background text-muted-foreground"
            }`}
            data-stage-key={step.key}
            data-state={step.state}
          >
            <StepIcon state={step.state} />
            <span className="truncate">{step.key === "ocr" && model.ocrReused ? "OCR 复用" : step.label}</span>
          </li>
        ))}
      </ol>
      {model.detail ? (
        <p className="mt-2 truncate text-[11px] text-muted-foreground" title={model.detail}>
          {model.detail}
        </p>
      ) : null}
    </section>
  );
}
