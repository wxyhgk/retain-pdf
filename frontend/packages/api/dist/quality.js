// quality — pure：一个任务的译文质量摘要与问题明细（GET /jobs/:id/quality-summary、/quality-items）。
// 字段按后端约定写在这里；契约（contracts）发布后改成从 @retainpdf/contracts 引类型。
import { buildApiHeaders, buildJobDetailEndpoint, unwrapEnvelope } from "./http.js";
async function getJson(url, label) {
    const resp = await fetch(url, { headers: buildApiHeaders() });
    if (!resp.ok) {
        const error = await resp.json().catch(() => null);
        throw new Error(error?.message || `读取${label}失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export function fetchQualitySummary(jobId, apiPrefix) {
    return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/quality-summary`, "质量摘要");
}
export function fetchQualityItems(jobId, apiPrefix, { kind, page, severity, offset = 0, limit = 200 }) {
    const params = new URLSearchParams({ kind, offset: `${offset}`, limit: `${limit}` });
    if (page)
        params.set("page", `${page}`);
    if (severity)
        params.set("severity", severity);
    return getJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/quality-items?${params}`, "质量明细");
}
