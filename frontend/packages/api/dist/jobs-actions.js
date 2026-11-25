// jobs-actions — pure (no mock)
// 请求走生成的函数（契约 job-actions.v1、job-reports.v1、library-books.v1），这里只管参数整理和报错。
// 提交类（取消、续跑、重试阶段、OCR 歧义）的报错和以前 submitJson 一样（submitFailure）。
import { stripOcrSuffix } from "./utils/strip-ocr.js";
import * as actions from "./generated/job-actions.js";
import * as reports from "./generated/job-reports.js";
import * as libraryBooks from "./generated/library-books.js";
import { failWith, failWithDetails, orOnStatus, submitFailure } from "./request.js";
import { newIdempotencyKey } from "./idempotency.js";
export async function fetchJobDiagnostics(jobId, apiPrefix) {
    return orOnStatus(reports.getFailureReport(apiPrefix, { job_id: jobId }, { onError: failWith("读取失败诊断失败，请稍后重试。") }), 404, null);
}
export async function fetchResumePlan(jobId, apiPrefix) {
    return orOnStatus(actions.getResumePlan(apiPrefix, { job_id: jobId }, { onError: failWith("读取恢复计划失败，请稍后重试。") }), 404, null);
}
/** body 可带 `{ overrides: { translation: { api_key | credential_ref } } }`：续跑出来的新任务用这把 key。 */
export async function resumeJob(jobId, apiPrefix, body = {}) {
    return actions.resumeJob(apiPrefix, { job_id: jobId, body: body }, { idempotencyKey: newIdempotencyKey(), onError: submitFailure() });
}
/**
 * 删一个任务和它的 `-ocr` 子任务，书留着（DELETE /jobs/:id，替代书架删除 DELETE /library/books/:id）。
 * 传 `-ocr` 子任务编号时删的是它的父任务。返回形状契约里叫 LibraryDeleteResultView。
 */
export async function deleteJob(apiPrefix, jobId, { force = false } = {}) {
    const normalizedJobId = stripOcrSuffix(`${jobId || ""}`);
    if (!normalizedJobId)
        throw new Error("删除失败: 缺少 job_id");
    // 409 的 error.details.reason 区分“任务还在跑”（job_active）和“别的任务还在用它的产物”（job_has_dependents）。
    return libraryBooks.deleteJob(apiPrefix, { job_id: normalizedJobId, query: { force: force || undefined } }, { onError: failWithDetails("删除任务失败，请稍后重试。") });
}
export async function cancelJob(jobId, apiPrefix) {
    return actions.cancelJob(apiPrefix, { job_id: jobId }, { onError: submitFailure() });
}
/** OCR 任务的取消和其它任务同一个地址（后端按任务类型分支）；保留这个名字给老调用方。 */
export async function cancelOcrJob(jobId, apiPrefix) {
    return cancelJob(jobId, apiPrefix);
}
export async function resolveOcrAmbiguity(jobId, apiPrefix, request) {
    return actions.resolveOcrAmbiguity(apiPrefix, { job_id: jobId, body: request }, { idempotencyKey: newIdempotencyKey(), onError: submitFailure() });
}
export async function fetchJobStageActions(jobId, apiPrefix) {
    return orOnStatus(actions.listJobActions(apiPrefix, { job_id: jobId }, { onError: failWith("读取阶段操作失败，请稍后重试。") }), 404, null);
}
/** retry-stage 请求体认的字段（后端 RetryStageRequest）。后端会对不认识的字段报 400。 */
const RETRY_STAGE_BODY_FIELDS = ["mode", "create_new_job", "overrides", "ambiguous_request_policy", "refine"];
/**
 * `payload` 里既有请求体字段，也可能带书的信息（document_id、title、cover_url…），后者只用来补返回值。
 * 请求体只发 RETRY_STAGE_BODY_FIELDS 里的字段。
 */
export async function retryJobStage(jobId, apiPrefix, stage, payload = {}) {
    const normalizedStage = `${stage || ""}`.trim();
    if (!normalizedStage)
        throw new Error("阶段重试失败: 缺少 stage");
    const body = { stage: normalizedStage };
    for (const field of RETRY_STAGE_BODY_FIELDS) {
        if (payload?.[field] !== undefined)
            body[field] = payload[field];
    }
    const result = await actions.retryJobStage(apiPrefix, 
    // 字段来自调用方的 payload，只挑了后端认的那几个；类型不对后端回 400。
    { job_id: jobId, body: body }, { idempotencyKey: newIdempotencyKey(), onError: submitFailure() });
    const bookMeta = payload && typeof payload === "object" ? payload : {};
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
