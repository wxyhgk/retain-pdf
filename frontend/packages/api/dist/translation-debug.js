// translation-debug — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildJobDetailEndpoint } from "./http.js";
export async function fetchTranslationDiagnostics(jobId, apiPrefix) {
    const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/diagnostics`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            throw new Error("未找到翻译调试信息，请确认该任务已完成翻译。");
        throw new Error(`读取翻译调试摘要失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchTranslationItems(jobId, apiPrefix, { limit = 20, offset = 0, page = "", finalStatus = "", errorType = "", route = "", q = "" } = {}) {
    const params = new URLSearchParams();
    params.set("limit", `${limit}`);
    params.set("offset", `${offset}`);
    if (`${page ?? ""}`.trim())
        params.set("page", `${page}`.trim());
    if (`${finalStatus ?? ""}`.trim())
        params.set("final_status", `${finalStatus}`.trim());
    if (`${errorType ?? ""}`.trim())
        params.set("error_type", `${errorType}`.trim());
    if (`${route ?? ""}`.trim())
        params.set("route", `${route}`.trim());
    if (`${q ?? ""}`.trim())
        params.set("q", `${q}`.trim());
    const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            return { items: [], total: 0, limit, offset };
        throw new Error(`读取翻译调试列表失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchTranslationItem(jobId, itemId, apiPrefix) {
    const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items/${itemId}`, { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404)
            throw new Error("未找到该翻译 item，请确认 item_id 是否正确。");
        throw new Error(`读取翻译 item 详情失败，请稍后重试。(${resp.status})`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function replayTranslationItem(jobId, itemId, apiPrefix) {
    const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items/${itemId}/replay`, { method: "POST", headers: buildApiHeaders() });
    if (!resp.ok) {
        const contentType = resp.headers.get("content-type") || "";
        if (resp.status === 404)
            throw new Error("未找到该翻译 item，无法重放。");
        if (contentType.includes("application/json")) {
            const errorPayload = await resp.json();
            throw new Error(`重放翻译 item 失败: ${errorPayload.message || JSON.stringify(errorPayload)}`);
        }
        const text = await resp.text();
        throw new Error(`重放翻译 item 失败: ${resp.status} ${text}`);
    }
    return unwrapEnvelope(await resp.json());
}
