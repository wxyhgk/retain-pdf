import * as MockJobsActions from "../mocks/jobs-actions.js";
import {
  cancelJob as _canonCancelJob,
  cancelOcrJob as _canonCancelOcrJob,
  deleteJob as _canonDeleteJob,
  fetchJobDiagnostics as _canonFetchJobDiagnostics,
  fetchJobStageActions as _canonFetchJobStageActions,
  fetchResumePlan as _canonFetchResumePlan,
  resolveOcrAmbiguity as _canonResolveOcrAmbiguity,
  resumeJob as _canonResumeJob,
  retryJobStage as _canonRetryJobStage,
} from "@retainpdf/api/jobs-actions";
import { mockable } from "./_mockable.js";
import { createTranslationSecretInjector } from "../translation-secret.js";

export type {
  JobRetryStage,
  JobStageActionsView,
  JobStageRetryActionView,
  JobDiagnosticsView,
  OcrAmbiguityReceiptField,
  OcrAmbiguityResolutionKind,
  OcrAmbiguityResolutionRequest,
  OcrAmbiguityResolutionView,
  OcrAmbiguityView,
} from "@retainpdf/api/jobs-actions";

export const fetchJobDiagnostics = mockable(_canonFetchJobDiagnostics, MockJobsActions.fetchJobDiagnostics);
export const fetchJobStageActions = mockable(_canonFetchJobStageActions, MockJobsActions.fetchJobStageActions);
export const fetchResumePlan = mockable(_canonFetchResumePlan, MockJobsActions.fetchResumePlan);
// 重跑类请求带上设置里当前的翻译密钥（换了 Key 之后不再沿用原任务那把），见 translation-secret.ts。
const injectTranslationSecret = createTranslationSecretInjector();

/** 409 derived_job_active 里那个还在排队或在跑的派生任务编号；别的错误返回空串。 */
export function derivedActiveJobId(error: unknown): string {
  const e = error as { reason?: unknown; activeJobId?: unknown } | null;
  if (e?.reason !== "derived_job_active") return "";
  return typeof e.activeJobId === "string" ? e.activeJobId.trim() : "";
}

/**
 * 续跑 / 重试时后端回 409 derived_job_active：这个任务已经续跑或重试出一个新任务，还在排队或在跑
 * （双击、两个窗口各点一次）。用户要的就是「让它接着跑」，那个任务正是答案：当作这次提交建出了它，
 * 返回一张指向它的回执（already_active: true），各入口照提交成功的路子切过去、开始跟进度；
 * 进度和状态由随后的轮询拿真的。回执里的 status 照后端提交回执的口径写 queued。
 */
function alreadyActiveReceipt(sourceJobId: string, activeJobId: string, bookMeta: Record<string, unknown> = {}) {
  return {
    job_id: activeJobId,
    active_job_id: activeJobId,
    source_job_id: sourceJobId,
    status: "queued",
    already_active: true,
    document_id: bookMeta.document_id || undefined,
    title: bookMeta.title || bookMeta.display_name || undefined,
    display_name: bookMeta.display_name || bookMeta.title || undefined,
    cover_url: bookMeta.cover_url || undefined,
    thumbnail_url: bookMeta.thumbnail_url || undefined,
    page_count: bookMeta.page_count ?? undefined,
    library_only: false,
  };
}

async function resumeJobWithCurrentKey(jobId: string, apiPrefix?: string, body: Record<string, unknown> = {}) {
  try {
    return await _canonResumeJob(jobId, apiPrefix, await injectTranslationSecret(jobId, apiPrefix, body));
  } catch (error) {
    const activeJobId = derivedActiveJobId(error);
    if (activeJobId) return alreadyActiveReceipt(jobId, activeJobId);
    throw error;
  }
}

async function retryJobStageWithCurrentKey(
  jobId: string,
  apiPrefix: string | undefined,
  stage: string,
  payload: Record<string, unknown> = {},
) {
  try {
    return await _canonRetryJobStage(jobId, apiPrefix, stage, await injectTranslationSecret(jobId, apiPrefix, payload));
  } catch (error) {
    const activeJobId = derivedActiveJobId(error);
    if (activeJobId) return alreadyActiveReceipt(jobId, activeJobId, payload || {});
    throw error;
  }
}

export const resumeJob = mockable(resumeJobWithCurrentKey, MockJobsActions.resumeJob);
export const cancelJob = mockable(_canonCancelJob, MockJobsActions.cancelJob);
export const deleteJob = mockable(_canonDeleteJob, MockJobsActions.deleteJob);
export const cancelOcrJob = mockable(_canonCancelOcrJob, MockJobsActions.cancelOcrJob);
export const resolveOcrAmbiguity = mockable(_canonResolveOcrAmbiguity, MockJobsActions.resolveOcrAmbiguity);
export const retryJobStage = mockable(retryJobStageWithCurrentKey, MockJobsActions.retryJobStage);

/**
 * 任务动作（取消、续跑、阶段重试、OCR 歧义恢复）被 409 拒绝时，后端在 error.details.reason 里说明原因
 * （submitJson 挂在错误对象的 reason 上）。这里给常见原因一句能照着做的中文；认不出来就照旧用后端原话。
 * 任务详情里「翻译请求拿不准」走二次确认（isAmbiguousTranslationRerunError），不经过这里；
 * 其它入口（任务中心、书籍详情）只能显示一句话，就告诉用户去哪里处理。
 */
const ACTION_CONFLICT_MESSAGES: Record<string, string> = {
  job_active: "任务还在跑，先取消再操作。",
  job_not_active: "任务已经不在运行，不用取消。",
  artifacts_missing: "需要的产物或原始文件不在了，没法从这一步继续。",
  translations_not_owned: "这个任务用的是别的任务的译文，要在那个任务上处理。",
  request_journal_corrupt: "翻译请求记录损坏，没法自动恢复，请重新翻译。",
  stale_resolution: "恢复信息已过期，请刷新后再试。",
  no_ocr_dispatch: "这个任务已经不需要处理 OCR 歧义，请刷新。",
  ambiguous_ocr_dispatch: "OCR 识别请求的结果拿不准，请打开任务详情的「问题」页处理（绑定已有识别任务，或确认重新识别）。",
  ambiguous_translation_request: "部分翻译请求可能已经计费，请打开任务详情确认重复费用风险后再从翻译阶段重试。",
  derived_job_active: "这个任务已经续跑 / 重试出一个新任务，还在排队或在跑：等它结束，或先取消它。",
  idempotency_key_in_flight: "上一次提交还在处理，稍等一下再试。",
};

export function describeActionError(error: unknown, fallback = "操作失败，请稍后重试。"): string {
  const reason = typeof (error as { reason?: unknown } | null)?.reason === "string"
    ? (error as { reason: string }).reason
    : "";
  if (reason && ACTION_CONFLICT_MESSAGES[reason]) return ACTION_CONFLICT_MESSAGES[reason];
  const message = `${(error as { message?: string } | null)?.message || error || ""}`.trim();
  return message || fallback;
}
