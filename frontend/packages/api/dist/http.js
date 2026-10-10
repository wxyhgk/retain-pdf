// frontend/packages/api/src/http.ts — canonical HTTP primitives (no mock, no window mock branching)
// Mirrors frontend/web/src/js/api/http.ts but pure: uses internal/runtime for apiBase/header/envelope.
import { apiBase, apiFetch, buildApiHeaders, buildApiUrl, frontendApiKey, getApiAuthMode, unwrapEnvelope } from "./internal/runtime.js";
export { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope };
export { apiFetch, getApiAuthMode, setApiAuthMode, setApiUnauthorizedHandler, } from "./internal/runtime.js";
export { API_PREFIX } from "./internal/runtime.js";
export function buildApiEndpoint(apiPrefix, relativePath = "") {
    return buildApiUrl(apiPrefix, relativePath);
}
// scope="ocr" 只用于创建 OCR 任务（POST /ocr/jobs）。读、取消 OCR 任务都走 /jobs/:id/…。
export function buildJobsEndpoint(apiPrefix, scope = "jobs") {
    return buildApiEndpoint(apiPrefix, scope === "ocr" ? "ocr/jobs" : "jobs");
}
export function buildJobDetailEndpoint(jobId, apiPrefix) {
    return `${buildJobsEndpoint(apiPrefix, "jobs")}/${encodeURIComponent(jobId)}`;
}
function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function summarizeJobRequestContext(payload) {
    if (!isObject(payload))
        return "";
    const p = payload;
    const workflow = `${p.workflow || ""}`.trim();
    const ocr = p.ocr;
    const source = p.source;
    const provider = `${ocr?.provider || ""}`.trim();
    const uploadId = `${source?.upload_id || ""}`.trim();
    const artifactJobId = `${source?.artifact_job_id || ""}`.trim();
    const parts = [];
    if (workflow)
        parts.push(`workflow=${workflow}`);
    if (provider)
        parts.push(`ocr.provider=${provider}`);
    if (uploadId)
        parts.push(`source.upload_id=${uploadId}`);
    if (artifactJobId)
        parts.push(`source.artifact_job_id=${artifactJobId}`);
    return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}
export async function submitJson(url, payload, options = {}) {
    const timeoutMs = Number(options.timeoutMs) || 0;
    // 裸 fetch 没有超时：对端挂起时 promise 永不 settle，调用方的"进行中"状态
    // 就再也回不来（凭据面板的检测按钮曾因此永久卡在灰色）。需要超时的调用方
    // 显式传 timeoutMs，其余调用方行为不变。
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timer = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;
    let resp;
    try {
        resp = await apiFetch(url, {
            method: "POST",
            headers: buildApiHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
            ...(controller ? { signal: controller.signal } : {}),
        });
    }
    catch (err) {
        if (controller?.signal.aborted) {
            const error = new Error(options.timeoutMessage || `请求超时（${Math.round(timeoutMs / 1000)}s）`);
            error.url = url;
            error.timedOut = true;
            throw error;
        }
        throw err;
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
    if (!resp.ok) {
        const requestContext = /\/api\/v1\/jobs(?:$|\?)/.test(url) ? summarizeJobRequestContext(payload) : "";
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const errorPayload = await resp.json();
            const error = new Error(`提交失败: ${resp.status} ${errorPayload.message || JSON.stringify(errorPayload)}${requestContext}`);
            error.status = resp.status;
            error.url = url;
            throw error;
        }
        const text = await resp.text();
        const error = new Error(`提交失败: ${resp.status} ${text}${requestContext}`);
        error.status = resp.status;
        error.url = url;
        throw error;
    }
    if (resp.status === 204)
        return { ok: true };
    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    const text = await resp.text();
    if (!text.trim())
        return { ok: true };
    if (!contentType.includes("application/json"))
        return text;
    return unwrapEnvelope(JSON.parse(text));
}
export function submitUploadRequest(url, form, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.responseType = "json";
        // 多用户模式靠登录 Cookie：带上凭据、不带部署密钥（和 apiFetch 一致）。
        const multi = getApiAuthMode() === "multi";
        xhr.withCredentials = multi;
        const apiKey = multi ? "" : frontendApiKey();
        if (apiKey)
            xhr.setRequestHeader("X-API-Key", apiKey);
        xhr.upload.addEventListener("progress", (event) => {
            if (!onProgress)
                return;
            if (event.lengthComputable)
                onProgress(event.loaded, event.total);
            else
                onProgress(NaN, NaN);
        });
        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(unwrapEnvelope(xhr.response));
                return;
            }
            const message = typeof xhr.response === "object" && xhr.response ? (xhr.response.message || JSON.stringify(xhr.response)) : (xhr.responseText || "");
            const error = new Error(`提交失败: ${xhr.status} ${message}`);
            error.status = xhr.status;
            error.url = url;
            reject(error);
        });
        xhr.addEventListener("error", () => {
            const error = new Error(`提交失败: 网络错误。当前 API Base 为 ${apiBase()}，上传地址为 ${url}。请确认本地服务已经启动。`);
            error.url = url;
            reject(error);
        });
        xhr.send(form);
    });
}
export async function fetchProtected(url, options = {}) {
    const headers = buildApiHeaders(options.headers || {});
    return apiFetch(url, { ...options, headers });
}
