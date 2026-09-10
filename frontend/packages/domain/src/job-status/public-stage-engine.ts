import { isJobTerminal } from "../job/core.js";
import type { JobLike, JobPayload, JobProgress } from "../job/types.js";
import {
  publicProgressOf,
  progressWithPercent,
} from "./progress/job-stage-progress-adapter.js";
import {
  jobProgressRecord,
} from "./progress/job-stage-job-progress.js";
import {
  collectLatestCurrentStageProgress,
} from "./progress/job-stage-progress-records.js";
import {
  substageMatchesStage,
  visualStageKeyForPresentation,
} from "./presentation/job-stage-presentation-helpers.js";
import {
  normalizeDisplayStage,
} from "./presentation/job-stage-presentation-utils.js";
import {
  normalizeSubstageKey,
  substageDetail,
} from "./contract/job-stage-substage-contract.js";
import {
  successDetailForWorkflow,
  summarizeStageDetail,
  summarizeStageLabel,
} from "./summary/job-status-summary.js";
import {
  progressTextForStageProgress,
} from "./summary/job-status-summary-progress.js";
import type {
  EventsPayload,
  ProgressRecord,
  PublicStagePresentation,
  StageSnapshot,
  StructuredProgress,
} from "./types.js";

export type {
  EventsPayload,
  ProgressRecord,
  PublicStagePresentation,
} from "./types.js";

const PUBLIC_FLOW_STAGE_KEYS = new Set(["ocr", "translate", "render", "done"]);
const ACTIVE_FLOW_STAGE_KEYS = new Set(["ocr", "translate", "render"]);
const IGNORED_SNAPSHOT_SOURCES = new Set(["legacy-stage", "canonical-empty-stage"]);

function publicStageName(stageKey = ""): string {
  return stageKey === "translate" ? "translation" : stageKey;
}

function normalizePublicStageKey(value = ""): string {
  const normalized = normalizeDisplayStage(value);
  return PUBLIC_FLOW_STAGE_KEYS.has(normalized) ? normalized : "";
}

function isCompletedJobStatus(status: unknown): boolean {
  return `${status || ""}`.trim().toLowerCase() === "succeeded";
}

// Guard against the UI jumping straight to "完成" while the job is still
// running. Backends sometimes flip `display_stage` / `stage_snapshot.publicStage`
// to `done` (or fire a final-artifact signal) before the run actually reaches a
// terminal status — the stage flow card would then mark every prior step done
// and skip render. Clamp `done` back to `render` until the job is truly
// succeeded; failed/canceled go through dedicated branches in `statusStageKey`.
function clampPublicStageForRunningJob(stageKey: string, status: unknown): string {
  if (stageKey === "done" && !isCompletedJobStatus(status)) {
    return "render";
  }
  return stageKey;
}

function snapshotObject(job: JobLike | JobPayload = {}): StageSnapshot | null {
  return job?.stage_snapshot && typeof job.stage_snapshot === "object"
    ? job.stage_snapshot as StageSnapshot
    : null;
}

function trustedSnapshot(job: JobLike | JobPayload = {}): StageSnapshot | null {
  const snapshot = snapshotObject(job);
  if (!snapshot) {
    return null;
  }
  const source = `${snapshot.source || ""}`.trim();
  if (IGNORED_SNAPSHOT_SOURCES.has(source)) {
    return null;
  }
  return snapshot;
}

export function publicStageKeyFromJob(job: JobLike | JobPayload = {}): string {
  const directStage = normalizePublicStageKey(job.display_stage);
  if (directStage) {
    return clampPublicStageForRunningJob(directStage, job?.status);
  }
  const snapshot = trustedSnapshot(job);
  if (!snapshot) {
    return "";
  }
  const snapshotStage = normalizePublicStageKey(snapshot.publicStage)
    || normalizePublicStageKey(snapshot.public_stage)
    || normalizePublicStageKey(snapshot.stageKey);
  return snapshotStage ? clampPublicStageForRunningJob(snapshotStage, job?.status) : "";
}

function statusStageKey(job: JobLike | JobPayload = {}): string {
  const status = `${job?.status || ""}`.trim().toLowerCase();
  if (status === "failed") {
    return "failed";
  }
  if (status === "canceled" || status === "cancelled") {
    return "canceled";
  }
  // Backend v1: succeeded jobs ship `stage_snapshot=null` and never advertise
  // display_stage="done". The 4-tab UI still needs to light up the final tab,
  // and the stage-pin's "fallback to previous stageKey" otherwise sticks the
  // card on whatever tab was active before close (typically OCR for short
  // runs). Map succeeded straight to "done" here.
  if (status === "succeeded") {
    return "done";
  }
  const publicStageKey = publicStageKeyFromJob(job);
  if (publicStageKey) {
    return publicStageKey;
  }
  if (status === "queued") {
    return "queued";
  }
  if (status === "running") {
    return "running";
  }
  return "idle";
}

function normalizeSubstageForStage(stageKey = "", value = ""): string {
  const substage = normalizeSubstageKey(value);
  if (!substage) {
    return "";
  }
  return substageMatchesStage(stageKey, substage) ? substage : "";
}

function publicSubstageKeyFromJob(job: JobLike | JobPayload = {}, stageKey = ""): string {
  const directSubstage = normalizeSubstageForStage(stageKey, job.substage);
  if (directSubstage) {
    return directSubstage;
  }
  const snapshot = trustedSnapshot(job);
  return normalizeSubstageForStage(stageKey, snapshot?.substage);
}

function stagePayloadForPresentation(
  job: JobLike | JobPayload = {},
  stageKey = "",
  substageKey = "",
  progress: ProgressRecord | JobProgress | StructuredProgress | Record<string, unknown> = {},
): JobLike {
  const progressAny = progress as ProgressRecord & StructuredProgress;
  return {
    status: job.status || "running",
    display_stage: publicStageName(stageKey),
    stage: stageKey === "translate" ? "translating" : stageKey,
    substage: substageKey,
    lane: "main",
    progress: {
      unit: progressAny.unit || progressAny.progressUnit || "",
      current: progressAny.current ?? null,
      total: progressAny.total ?? null,
      percent: progressAny.percent ?? progressAny.progressPercent ?? progressAny.displayPercent ?? null,
    },
  };
}

function sanitizedJobForStage(
  job: JobLike | JobPayload = {},
  stageKey = "",
  substageKey = "",
): JobLike {
  const snapshot = trustedSnapshot(job);
  const snapshotProgress = snapshot?.progress && typeof snapshot.progress === "object"
    ? snapshot.progress
    : null;
  return {
    ...job,
    display_stage: publicStageName(stageKey),
    user_stage: "",
    current_stage: "",
    stage: stageKey === "translate" ? "translating" : stageKey,
    substage: substageKey,
    progress: snapshotProgress || job.progress,
  };
}

function chooseCurrentStageProgress(
  job: JobLike | JobPayload = {},
  eventsPayload: EventsPayload = {},
  stageKey = "",
  substageKey = "",
): ProgressRecord | null {
  if (!ACTIVE_FLOW_STAGE_KEYS.has(stageKey)) {
    return null;
  }
  const sanitizedJob = sanitizedJobForStage(job, stageKey, substageKey);
  const eventProgress = collectLatestCurrentStageProgress(sanitizedJob, eventsPayload || {}, stageKey, "");
  const fallbackProgress = jobProgressRecord(sanitizedJob, stageKey);
  if (hasUsefulProgress(eventProgress)) {
    return eventProgress;
  }
  return fallbackProgress;
}

function finiteNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function hasUsefulProgress(progress: ProgressRecord | null | undefined = null): boolean {
  if (!progress) {
    return false;
  }
  const current = finiteNumber(progress.current ?? progress.progressCurrent);
  const total = finiteNumber(progress.total ?? progress.progressTotal);
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    return true;
  }
  if (Number.isFinite(finiteNumber(progress.displayPercent ?? progress.progressPercent))) {
    return true;
  }
  return false;
}

function genericProgressRecord(
  job: JobLike | JobPayload = {},
  stageKey = "",
  substageKey = "",
): ProgressRecord | null {
  const progress = progressWithPercent(publicProgressOf(job));
  if (progress.current === null && progress.total === null && progress.percent === null) {
    return null;
  }
  const percentOnlyCurrent = progress.unit === "percent" && progress.current === null && progress.percent !== null
    ? progress.percent
    : progress.current;
  const percentOnlyTotal = progress.unit === "percent" && progress.total === null && progress.percent !== null
    ? 100
    : progress.total;
  const textProgress = {
    ...progress,
    current: percentOnlyCurrent,
    total: percentOnlyTotal,
  };
  return {
    current: percentOnlyCurrent,
    total: percentOnlyTotal,
    progressPercent: progress.percent,
    displayPercent: progress.percent,
    progressUnit: progress.unit,
    substageKey,
    visualStageKey: stageKey,
    progressText: progressTextForStageProgress({
      stageKey,
      substageKey,
      stage: { key: stageKey },
      progress: textProgress,
    }),
    indeterminate: false,
  };
}

function doneProgressRecord(): ProgressRecord {
  return {
    current: 100,
    total: 100,
    progressPercent: 100,
    displayPercent: 100,
    progressUnit: "percent",
    progressText: "渲染完成",
    substageKey: "render_compile",
    visualStageKey: "render_compile",
    indeterminate: false,
  };
}

function progressForPresentation(
  job: JobLike | JobPayload = {},
  eventsPayload: EventsPayload = {},
  stageKey = "",
  substageKey = "",
): ProgressRecord | null {
  if (stageKey === "done") {
    return doneProgressRecord();
  }
  return chooseCurrentStageProgress(job, eventsPayload, stageKey, substageKey)
    || genericProgressRecord(job, stageKey, substageKey);
}

function labelForStage(
  job: JobLike | JobPayload = {},
  stageKey = "",
  substageKey = "",
  progress: ProgressRecord | Record<string, unknown> = {},
): string {
  if (stageKey === "done") {
    return "完成";
  }
  if (stageKey === "failed") {
    return "失败";
  }
  if (stageKey === "canceled") {
    return "已取消";
  }
  return summarizeStageLabel(stagePayloadForPresentation(job, stageKey, substageKey, progress));
}

function detailForStage(
  job: JobLike | JobPayload = {},
  stageKey = "",
  substageKey = "",
  progress: ProgressRecord | Record<string, unknown> = {},
): string {
  if (stageKey === "done") {
    return successDetailForWorkflow(job);
  }
  if (stageKey === "failed") {
    return "任务失败，请查看详情";
  }
  if (stageKey === "canceled") {
    return "任务已取消";
  }
  return substageDetail(substageKey)
    || summarizeStageDetail(stagePayloadForPresentation(job, stageKey, substageKey, progress));
}

function displayPercentFromProgress(progress: ProgressRecord | Record<string, unknown> = {}): number | null {
  const progressAny = progress as ProgressRecord;
  const explicit: unknown = progressAny.displayPercent ?? progressAny.progressPercent ?? null;
  if (explicit !== null && explicit !== undefined && explicit !== "") {
    const number = Number(explicit);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
  }
  const current = Number(progressAny.current);
  const total = Number(progressAny.total);
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0 && progressAny.progressUnit === "percent") {
    return Math.max(0, Math.min(100, current));
  }
  return null;
}

export function resolvePublicStagePresentation(
  job: JobLike | JobPayload = {},
  eventsPayload: EventsPayload = {},
): PublicStagePresentation {
  const stageKey = statusStageKey(job);
  // Succeeded jobs should be a trusted "done" — otherwise the stage-pin
  // fallback resurrects the previous tab (typically OCR) when the dialog is
  // reopened on a finished job.
  const trustedStage = PUBLIC_FLOW_STAGE_KEYS.has(stageKey)
    && (isCompletedJobStatus(job?.status) || Boolean(publicStageKeyFromJob(job)));
  const jobSubstageKey = publicSubstageKeyFromJob(job, stageKey);
  const progress = progressForPresentation(job, eventsPayload || {}, stageKey, jobSubstageKey);
  const substageKey = progress?.substageKey || jobSubstageKey;
  const progressText = progress?.progressText || "";
  const payload = stagePayloadForPresentation(job, stageKey, substageKey, progress || {});
  const progressPercent = progress?.progressPercent ?? publicProgressOf(job).percent;
  const displayPercent = displayPercentFromProgress(progress || {});
  const visualStageKey = progress?.visualStageKey
    || (stageKey === "done" ? "render_compile" : visualStageKeyForPresentation(payload, stageKey));

  return {
    stageKey,
    stageKeyTrusted: trustedStage,
    visualStageKey,
    label: labelForStage(job, stageKey, substageKey, progress || {}),
    detail: detailForStage(job, stageKey, substageKey, progress || {}),
    progressText,
    progressCurrent: progress?.current ?? null,
    progressTotal: progress?.total ?? null,
    progressPercent,
    displayPercent,
    progressUnit: progress?.progressUnit || "",
    substageKey,
    progressIndeterminate: Boolean(progress?.indeterminate),
    terminal: isJobTerminal(job),
  };
}
