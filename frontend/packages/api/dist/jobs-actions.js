// jobs-actions — pure (no mock)
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildJobDetailEndpoint, submitJson } from "./http.js";
export async function fetchJobDiagnostics(jobId, apiPrefix) {
    const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/diagnostics`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            return null;
        throw new Error(`读取失败诊断失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchResumePlan(jobId, apiPrefix) {
    const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/resume-plan`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            return null;
        throw new Error(`读取恢复计划失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function resumeJob(jobId, apiPrefix) {
    return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/resume`, {});
}
export async function cancelJob(jobId, apiPrefix) {
    return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/cancel`, {});
}
export async function cancelOcrJob(jobId, apiPrefix) {
    const endpoint = buildJobDetailEndpoint(jobId, apiPrefix).replace(/\/jobs\//, "/ocr/jobs/");
    return submitJson(`${endpoint}/cancel`, {});
}
export async function resolveOcrAmbiguity(jobId, apiPrefix, request) {
    return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/ocr/resolve-ambiguity`, request);
}
export async function fetchJobStageActions(jobId, apiPrefix) {
    const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/stage-actions`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            return null;
        throw new Error(`读取阶段操作失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function retryJobStage(jobId, apiPrefix, stage, payload = {}) {
    const normalizedStage = `${stage || ""}`.trim();
    if (!normalizedStage)
        throw new Error("阶段重试失败: 缺少 stage");
    const result = await submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/retry-stage`, { stage: normalizedStage, ...payload });
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
export async function rerunJob(actionUrl) {
    return submitJson(actionUrl, {});
}
