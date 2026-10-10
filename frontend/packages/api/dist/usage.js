import { buildApiEndpoint, buildApiHeaders, unwrapEnvelope } from "./http.js";
async function fetchUsage(url, label) {
    const resp = await fetch(url, { headers: buildApiHeaders() });
    if (!resp.ok) {
        const error = await resp.json().catch(() => null);
        throw new Error(error?.message || `读取${label}用量失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
/** 一本书的全部任务，加上问这本书时助手花的。 */
export function fetchDocumentUsage(documentId, apiPrefix) {
    return fetchUsage(buildApiEndpoint(apiPrefix, `documents/${encodeURIComponent(documentId)}/usage`), "这本书的");
}
/** 全部用量（删除的书不计入）。 */
export function fetchUsageSummary(apiPrefix) {
    return fetchUsage(buildApiEndpoint(apiPrefix, "usage"), "");
}
/** 单个任务；任务不存在时后端返回 404。 */
export function fetchJobUsage(jobId, apiPrefix) {
    return fetchUsage(buildApiEndpoint(apiPrefix, `jobs/${encodeURIComponent(jobId)}/usage`), "这个任务的");
}
