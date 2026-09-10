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
 * Pick the newest successful OCR-only job as a translation source candidate.
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
    .filter((job) => {
      const jobId = text(job?.job_id || job?.id);
      return workflowOf(job) === "ocr"
        && text(job?.status).toLowerCase() === "succeeded"
        && Boolean(jobId)
        && !jobId.startsWith("doc:")
        && job?.ocr_reusable !== false
        && job?.translation_source_ready !== false;
    })
    .map((job, index) => ({ job, index, timestamp: timestampOf(job) }))
    .sort((left, right) => right.timestamp - left.timestamp || left.index - right.index)[0]?.job || null;
}

/**
 * Processing 页面展示的是“当前文档是否已有 OCR 能力”，不局限于 OCR-only job。
 * 整本翻译成功、翻译复用 OCR，或流水线已经越过 OCR 阶段，都能作为完成证据。
 */
export function selectDocumentOcrStatusJob(
  jobs: DocumentJobSummary[] = [],
): DocumentJobSummary | null {
  for (const job of jobs) {
    if (workflowOf(job) === "ocr") return job;
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
