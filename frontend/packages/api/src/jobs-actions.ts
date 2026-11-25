// jobs-actions — pure (no mock)
// 请求走生成的函数（契约 job-actions.v1、job-reports.v1、library-books.v1），这里只管参数整理和报错。
// 提交类（取消、续跑、重试阶段、OCR 歧义）的报错和以前 submitJson 一样（submitFailure）。
import { stripOcrSuffix } from "./utils/strip-ocr.js";
import * as actions from "./generated/job-actions.js";
import * as reports from "./generated/job-reports.js";
import * as libraryBooks from "./generated/library-books.js";
import { failWith, failWithDetails, orOnStatus, submitFailure } from "./request.js";
import { newIdempotencyKey } from "./idempotency.js";
import type { OcrAmbiguityResolutionView, ResumeJobInput, RetryStageRequest } from "@retainpdf/contracts/job-actions";
import type { LibraryDeleteResultView } from "@retainpdf/contracts/library-books";

export type OcrAmbiguityResolutionKind = "bind_existing_receipt" | "accept_duplicate_risk";

export interface OcrAmbiguityResolutionRequest {
  resolution: OcrAmbiguityResolutionKind;
  resolution_revision: number;
  task_id?: string;
  batch_id?: string;
  upload_url?: string;
  trace_id?: string;
}

export interface OcrAmbiguityReceiptField {
  name: "task_id" | "batch_id" | "upload_url" | "trace_id";
  label: string;
  required: boolean;
  secret: boolean;
}

export interface OcrAmbiguityView {
  status: "ambiguous";
  provider: "paddle" | "mineru";
  operation:
    | "submit_local_file"
    | "submit_remote_url"
    | "create_extract_task"
    | "apply_upload_url";
  resolution_revision: number;
  allowed_resolutions: OcrAmbiguityResolutionKind[];
  receipt_fields: OcrAmbiguityReceiptField[];
}

export interface JobDiagnosticsView {
  failure_code: string | null;
  ocr_ambiguity: OcrAmbiguityView | null;
  [key: string]: unknown;
}

/** 解决 OCR 歧义后的结果，形状以契约 job-actions.v1 为准。 */
export type { OcrAmbiguityResolutionView } from "@retainpdf/contracts/job-actions";

// refine：在已有译文上挑错 + 定点修改，原地执行、不重翻，完成后自动重渲染一次。
export type JobRetryStage = "ocr" | "translation" | "render" | "refine";

/** 上次精修的摘要（只在 stage=refine 上，没精修过时没有）。 */
export interface LastRefineView {
  /** completed / stopped / failed */
  status: string;
  generated_at: string;
  finding_count: number;
  applied: number;
  reviewed_item_count: number;
  candidate_item_count: number;
  unreviewed_item_count: number;
  /** 没审到的第一页（1-based）；全审到为 null。 */
  next_page: number | null;
  stopped_reason: string | null;
  /** review_only / review_and_fix / editorial；老后端没有。 */
  mode?: string;
  /** 编辑部留给人确认的块数。 */
  escalated_count?: number;
  /** 留给人确认的块（最多 50 条，按书中顺序）。 */
  escalated?: Array<{ item_id: string; page_number: number; reason: string }>;
}

export interface JobStageRetryActionView {
  stage: JobRetryStage;
  label: string;
  can_retry: boolean;
  reason?: string;
  disabled_reason?: string;
  will_reuse?: string[];
  will_rerun?: string[];
  danger?: boolean;
  last_refine?: LastRefineView;
  action?: {
    method?: string;
    url?: string;
    body?: Record<string, unknown>;
  } | null;
}

export interface JobStageActionsView {
  job_id: string;
  stages: JobStageRetryActionView[];
}

export async function fetchJobDiagnostics(jobId: string, apiPrefix?: string): Promise<JobDiagnosticsView | null> {
  return orOnStatus(
    reports.getFailureReport(apiPrefix, { job_id: jobId }, { onError: failWith("读取失败诊断失败，请稍后重试。") }),
    404,
    null,
  );
}

export async function fetchResumePlan(jobId: string, apiPrefix?: string): Promise<any> {
  return orOnStatus(
    actions.getResumePlan(apiPrefix, { job_id: jobId }, { onError: failWith("读取恢复计划失败，请稍后重试。") }),
    404,
    null,
  );
}

/** body 可带 `{ overrides: { translation: { api_key | credential_ref } } }`：续跑出来的新任务用这把 key。 */
export async function resumeJob(jobId: string, apiPrefix?: string, body: Record<string, unknown> = {}): Promise<any> {
  return actions.resumeJob(apiPrefix, { job_id: jobId, body: body as ResumeJobInput }, { idempotencyKey: newIdempotencyKey(), onError: submitFailure() });
}

/**
 * 删一个任务和它的 `-ocr` 子任务，书留着（DELETE /jobs/:id，替代书架删除 DELETE /library/books/:id）。
 * 传 `-ocr` 子任务编号时删的是它的父任务。返回形状契约里叫 LibraryDeleteResultView。
 */
export async function deleteJob(
  apiPrefix: string | undefined,
  jobId: string,
  { force = false } = {},
): Promise<LibraryDeleteResultView> {
  const normalizedJobId = stripOcrSuffix(`${jobId || ""}`);
  if (!normalizedJobId) throw new Error("删除失败: 缺少 job_id");
  // 409 的 error.details.reason 区分“任务还在跑”（job_active）和“别的任务还在用它的产物”（job_has_dependents）。
  return libraryBooks.deleteJob(
    apiPrefix,
    { job_id: normalizedJobId, query: { force: force || undefined } },
    { onError: failWithDetails("删除任务失败，请稍后重试。") },
  );
}

export async function cancelJob(jobId: string, apiPrefix?: string): Promise<any> {
  return actions.cancelJob(apiPrefix, { job_id: jobId }, { onError: submitFailure() });
}

/** OCR 任务的取消和其它任务同一个地址（后端按任务类型分支）；保留这个名字给老调用方。 */
export async function cancelOcrJob(jobId: string, apiPrefix?: string): Promise<any> {
  return cancelJob(jobId, apiPrefix);
}

export async function resolveOcrAmbiguity(
  jobId: string,
  apiPrefix: string | undefined,
  request: OcrAmbiguityResolutionRequest,
): Promise<OcrAmbiguityResolutionView> {
  return actions.resolveOcrAmbiguity(apiPrefix, { job_id: jobId, body: request }, { idempotencyKey: newIdempotencyKey(), onError: submitFailure() });
}

export async function fetchJobStageActions(jobId: string, apiPrefix?: string): Promise<JobStageActionsView | null> {
  return orOnStatus(
    actions.listJobActions(apiPrefix, { job_id: jobId }, { onError: failWith("读取阶段操作失败，请稍后重试。") }),
    404,
    null,
  );
}

/** retry-stage 请求体认的字段（后端 RetryStageRequest）。后端会对不认识的字段报 400。 */
const RETRY_STAGE_BODY_FIELDS = ["mode", "create_new_job", "overrides", "ambiguous_request_policy", "refine"] as const;

/**
 * `payload` 里既有请求体字段，也可能带书的信息（document_id、title、cover_url…），后者只用来补返回值。
 * 请求体只发 RETRY_STAGE_BODY_FIELDS 里的字段。
 */
export async function retryJobStage(jobId: string, apiPrefix: string | undefined, stage: string, payload: Record<string, unknown> = {}): Promise<any> {
  const normalizedStage = `${stage || ""}`.trim();
  if (!normalizedStage) throw new Error("阶段重试失败: 缺少 stage");
  const body: Record<string, unknown> = { stage: normalizedStage };
  for (const field of RETRY_STAGE_BODY_FIELDS) {
    if (payload?.[field] !== undefined) body[field] = payload[field];
  }
  const result: any = await actions.retryJobStage(
    apiPrefix,
    // 字段来自调用方的 payload，只挑了后端认的那几个；类型不对后端回 400。
    { job_id: jobId, body: body as unknown as RetryStageRequest },
    { idempotencyKey: newIdempotencyKey(), onError: submitFailure() },
  );
  const bookMeta: any = payload && typeof payload === "object" ? payload : {};
  const nextJobId = `${result?.job_id || result?.id || jobId}`.trim();
  return {
    ...result,
    job_id: nextJobId,
    source_job_id: jobId,
    document_id: result?.document_id || bookMeta.document_id,
    title: bookMeta.title || bookMeta.display_name || result?.title,
    display_name: bookMeta.display_name || bookMeta.title || result?.display_name,
    cover_url: bookMeta.cover_url || result?.cover_url,
    thumbnail_url: bookMeta.thumbnail_url || result?.thumbnail_url,
    page_count: bookMeta.page_count ?? result?.page_count,
    library_only: false,
    active_job_id: nextJobId,
  };
}

