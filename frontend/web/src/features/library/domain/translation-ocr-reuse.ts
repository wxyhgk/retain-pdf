import type {
  DocumentJobSummary,
  TranslateDocumentPayload,
} from "./types.js";

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function workflowOf(job?: DocumentJobSummary | null): string {
  return text(job?.workflow || job?.job_type).toLowerCase();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function translationOcrStatus(job: DocumentJobSummary): string {
  const workflow = workflowOf(job);
  if (!["book", "translate", "translation", "render"].includes(workflow)) return "";

  const stageState = text(record(record(job.stages).ocr).state).toLowerCase();
  if (stageState === "completed" || stageState === "reused") return "succeeded";
  if (stageState === "in_progress") return "running";
  if (stageState === "queued") return "queued";
  if (stageState === "failed") return "failed";

  const status = text(job.status).toLowerCase();
  if (status === "succeeded" || job.ocr_reused === true) return "succeeded";
  // translate/render 工作流只能在已有 OCR/译文产物上启动。
  if (workflow === "translate" || workflow === "translation" || workflow === "render") {
    return "succeeded";
  }
  const activeStage = text(job.display_stage || job.stage).toLowerCase();
  if (["translation", "translate", "translating", "render", "rendering", "done", "finished"].includes(activeStage)) {
    return "succeeded";
  }
  return "";
}

function timestampOf(job: DocumentJobSummary): number {
  const value = Date.parse(text(job.updated_at || job.created_at));
  return Number.isFinite(value) ? value : 0;
}

/**
 * 复用候选的优先级：0 = 独立 OCR 任务，1 = OCR 阶段已成功的 book/translate/render 任务。
 * 返回 -1 表示该任务不能作为复用候选。
 */
function reuseRank(job: DocumentJobSummary): number {
  const jobId = text(job?.job_id || job?.id);
  // 后端明确的不可复用信号，任何工作流都不放宽。
  if (!jobId || jobId.startsWith("doc:")) return -1;
  if (job?.ocr_reusable === false || job?.translation_source_ready === false) return -1;

  if (workflowOf(job) === "ocr") {
    return text(job?.status).toLowerCase() === "succeeded" ? 0 : -1;
  }
  // 后端 ocr_artifact_reuse 支持从整本/翻译/渲染任务复用其自身 OCR 产物，
  // 即使任务整体失败；判定沿用文档 OCR 状态那一套。
  return translationOcrStatus(job) === "succeeded" ? 1 : -1;
}

/**
 * Pick the newest job whose OCR artifact can seed a translation.
 *
 * Standalone succeeded OCR jobs win over jobs that merely cleared their OCR
 * stage; within one tier the newest wins.
 *
 * This is deliberately only a candidate: artifact completeness, provider
 * compatibility, document ownership and page coverage remain backend-owned
 * validations. Explicit backend `ocr_reusable: false` is respected so the
 * frontend never knowingly offers an incompatible artifact.
 */
export function selectReusableOcrJob(
  jobs: DocumentJobSummary[] = [],
): DocumentJobSummary | null {
  return jobs
    .map((job, index) => ({ job, index, rank: reuseRank(job) }))
    .filter((entry) => entry.rank >= 0)
    .map((entry) => ({ ...entry, timestamp: timestampOf(entry.job) }))
    .sort((left, right) => left.rank - right.rank
      || right.timestamp - left.timestamp
      || left.index - right.index)[0]?.job || null;
}

/**
 * Processing 页面展示的是“当前文档是否已有 OCR 能力”，不局限于 OCR-only job。
 * 整本翻译成功、翻译复用 OCR，或流水线已经越过 OCR 阶段，都能作为完成证据。
 *
 * 翻译任务有自己的 OCR 子任务（`{翻译任务}-ocr`）时用子任务本身，不从翻译任务推：列表按更新时间排，
 * 翻译任务通常排在子任务前面。OCR 和翻译并行时（GLM-OCR）翻译任务一开始就进 translating，从它推出来是
 * 「OCR 已完成」，OCR 站其实还在跑；跑完以后推出来的也没有子任务自己的计时。
 */
export function selectDocumentOcrStatusJob(
  jobs: DocumentJobSummary[] = [],
): DocumentJobSummary | null {
  const byId = new Map(jobs.map((job) => [text(job.job_id || job.id), job]));
  for (const job of jobs) {
    if (workflowOf(job) === "ocr") return job;
    const child = byId.get(`${text(job.job_id || job.id)}-ocr`);
    if (child && workflowOf(child) === "ocr") return child;
    const status = translationOcrStatus(job);
    if (!status) continue;
    return {
      ...job,
      workflow: "ocr",
      job_type: "ocr",
      status,
      ocr_status_derived: true,
      ocr_status_source_workflow: workflowOf(job),
    };
  }
  return null;
}

export function reusableOcrJobId(job?: DocumentJobSummary | null): string {
  return text(job?.job_id || job?.id);
}

export function inclusivePageNumbers(startPage: number, endPage: number): number[] {
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage) {
    return [];
  }
  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}

/** A translate workflow starts from an existing OCR artifact by definition. */
export function translationUsesReusedOcr(item?: Record<string, unknown> | null): boolean {
  if (!item) return false;
  if (item.ocr_reused === true) return true;
  const stages = item.stages && typeof item.stages === "object"
    ? item.stages as Record<string, unknown>
    : {};
  const ocr = stages.ocr && typeof stages.ocr === "object"
    ? stages.ocr as Record<string, unknown>
    : {};
  if (text(ocr.state).toLowerCase() === "reused") return true;
  return text(item.workflow || item.job_type).toLowerCase() === "translate";
}

/**
 * Merge credentials/config with per-launch overrides without leaking the OCR
 * config into an artifact-backed translation request.
 */
export function mergeTranslatePayload(
  base: TranslateDocumentPayload = {},
  overrides: TranslateDocumentPayload = {},
): TranslateDocumentPayload {
  const artifactJobId = text(overrides.source?.artifact_job_id);
  const reusingOcr = text(overrides.workflow).toLowerCase() === "translate" && Boolean(artifactJobId);
  const merged: TranslateDocumentPayload = {
    ...base,
    ...overrides,
  };

  if (base.translation || overrides.translation) {
    merged.translation = { ...(base.translation || {}), ...(overrides.translation || {}) };
  }

  if (reusingOcr) {
    delete merged.ocr;
    merged.workflow = "translate";
    merged.source = {
      ...(base.source || {}),
      ...(overrides.source || {}),
      artifact_job_id: artifactJobId,
    };
  } else if (base.ocr || overrides.ocr) {
    merged.ocr = { ...(base.ocr || {}), ...(overrides.ocr || {}) };
  }

  return merged;
}
