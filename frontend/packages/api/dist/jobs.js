// Jobs API — standalone, wraps job-status.v1
// No frontend/web deps; browser-aware (reads window.__FRONT_RUNTIME_CONFIG__ for apiBase / X-API-Key if present).
import { API_PREFIX, buildApiHeaders, buildApiUrl, unwrapEnvelope } from "./internal/runtime.js";
// OCR 任务也走 /jobs（后端已统一）；/ocr/jobs 只剩创建 OCR 任务那一个入口（见 jobs-submit.ts）。
function buildJobsEndpoint(apiPrefix) {
    return buildApiUrl(apiPrefix, "jobs");
}
function buildJobDetailEndpoint(jobId, apiPrefix) {
    return `${buildJobsEndpoint(apiPrefix)}/${encodeURIComponent(jobId)}`;
}
function jobRequestError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}
function normalizeJobPayloadArgs(a, b) {
    // Deprecated swapped order: (apiPrefix, jobId) heuristics via a.startsWith("/")
    if (typeof a === "string" &&
        a.startsWith("/") &&
        typeof b === "string" &&
        b != null &&
        !b.startsWith("/")) {
        if (typeof console !== "undefined" && console.warn) {
            console.warn("[deprecated] fetchJobPayload(apiPrefix, jobId) is deprecated, use fetchJobPayload(jobId, { apiPrefix })");
        }
        return { apiPrefix: a, jobId: b };
    }
    if (typeof b === "string") {
        if (typeof console !== "undefined" && console.warn) {
            console.warn("[deprecated] fetchJobPayload(jobId, apiPrefix) string form is deprecated, use fetchJobPayload(jobId, { apiPrefix })");
        }
        return { jobId: a, apiPrefix: b };
    }
    if (b && typeof b === "object") {
        return { jobId: a, apiPrefix: b.apiPrefix };
    }
    return { jobId: a, apiPrefix: undefined };
}
export async function fetchJobPayload(a, b) {
    const { jobId, apiPrefix } = normalizeJobPayloadArgs(a, b);
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId)
        throw new Error("读取任务失败: 缺少 job_id");
    // 通用地址同时覆盖翻译与 OCR 任务，不再 404 后退到 /ocr/jobs/ 别名。
    const resp = await fetch(buildJobDetailEndpoint(normalizedJobId, apiPrefix), { headers: buildApiHeaders() });
    if (!resp.ok) {
        if (resp.status === 404) {
            throw jobRequestError("未找到该任务，请检查 job_id 是否正确。", 404);
        }
        throw jobRequestError(`读取任务失败，请稍后重试。(${resp.status})`, resp.status);
    }
    return unwrapEnvelope(await resp.json());
}
export async function fetchJobList(apiPrefix = API_PREFIX, { limit = 20, offset = 0, status = "", workflow = "", provider = "", scope = "jobs", q = "", includeLiveStage = true, } = {}) {
    const params = new URLSearchParams();
    params.set("limit", `${limit}`);
    params.set("offset", `${offset}`);
    if (status)
        params.set("status", status);
    if (workflow)
        params.set("workflow", workflow);
    if (provider)
        params.set("provider", provider);
    if (`${q || ""}`.trim())
        params.set("q", `${q || ""}`.trim());
    if (!includeLiveStage)
        params.set("include_live_stage", "false");
    // 只看 OCR 任务：在通用列表上按 workflow 过滤，不再走 /ocr/jobs 列表别名。
    if (scope === "ocr" && !workflow)
        params.set("workflow", "ocr");
    const endpoint = buildJobsEndpoint(apiPrefix);
    const resp = await fetch(`${endpoint}?${params.toString()}`, { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取最近任务失败，请稍后重试。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
