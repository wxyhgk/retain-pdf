// frontend/packages/api/src/http.ts — canonical HTTP primitives (no mock, no window mock branching)
// Mirrors frontend/web/src/js/api/http.ts but pure: uses internal/runtime for apiBase/header/envelope.
import { apiBase, apiFetch, buildApiHeaders, buildApiUrl, frontendApiKey, getApiAuthMode, unwrapEnvelope } from "./internal/runtime.js";
export { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope };
export { apiFetch, getApiAuthMode, setApiAuthMode, setApiUnauthorizedHandler, } from "./internal/runtime.js";
export { API_PREFIX } from "./internal/runtime.js";
export function buildApiEndpoint(apiPrefix, relativePath = "") {
    return buildApiUrl(apiPrefix, relativePath);
}
/** 上传 PDF 的地址（POST /uploads）。网页要上传进度，用 XHR 自己发，地址也从这里拿。 */
export function buildUploadsEndpoint(apiPrefix) {
    return buildApiEndpoint(apiPrefix, "uploads");
}
// 所有任务（含只做 OCR 的）都在 /jobs 下：建、读、取消都不再用 /ocr/jobs。
export function buildJobsEndpoint(apiPrefix) {
    return buildApiEndpoint(apiPrefix, "jobs");
}
export function buildJobDetailEndpoint(jobId, apiPrefix) {
    return `${buildJobsEndpoint(apiPrefix)}/${encodeURIComponent(jobId)}`;
}
function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
/** 建任务失败时附在报错后面的请求摘要（workflow、OCR 服务商、上传编号）。 */
export function summarizeJobRequestContext(payload) {
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
/** 读后端错误信封里的 error.code 和 error.details.reason，挂到错误对象上。 */
export function attachErrorDetails(error, errorPayload) {
    const structured = errorPayload?.error && typeof errorPayload.error === "object" ? errorPayload.error : null;
    const code = typeof structured?.code === "string" ? structured.code.trim() : "";
    if (code)
        error.errorCode = code;
    const reason = typeof structured?.details?.reason === "string" ? structured.details.reason.trim() : "";
    if (reason)
        error.reason = reason;
    return error;
}
/** 多用户按页额度：建任务时余额不够，后端回 402 + 这个错误码，message 是给用户看的中文。 */
export const PAGE_QUOTA_EXCEEDED = "PAGE_QUOTA_EXCEEDED";
function finiteOrNull(value) {
    const n = Number(value);
    return value === null || value === undefined || value === "" || !Number.isFinite(n) ? null : n;
}
/**
 * 错误响应是「页数额度不够」就做成 PageQuotaError：message 直接用后端的中文，不加「提交失败: 402」
 * 这类前缀，界面原样显示即可。不是就返回 null，调用方走原来的报错。
 */
export function pageQuotaErrorFromPayload(status, payload, url) {
    const p = (isObject(payload) ? payload : {});
    const structured = isObject(p.error) ? p.error : {};
    const code = `${structured.code || p.code || ""}`.trim().toUpperCase();
    if (code !== PAGE_QUOTA_EXCEEDED)
        return null;
    const details = isObject(structured.details) ? structured.details : {};
    const message = `${p.message || structured.message || ""}`.trim() || "页数额度不够，请联系管理员。";
    const error = new Error(message);
    error.name = "PageQuotaError";
    error.code = PAGE_QUOTA_EXCEEDED;
    error.status = status;
    error.requiredPages = finiteOrNull(details.required_pages);
    error.balance = finiteOrNull(details.balance);
    if (url)
        error.url = url;
    return error;
}
export function isPageQuotaError(error) {
    return !!error && typeof error === "object" && error.code === PAGE_QUOTA_EXCEEDED;
}
/** 数据目录所在的磁盘快满了：上传、建任务、原地重跑回 503，error.details.reason 是这个。后端的 message 是英文，不给用户看。 */
export const INSUFFICIENT_STORAGE = "insufficient_storage";
export const INSUFFICIENT_STORAGE_MESSAGE = "磁盘空间不够，删掉一些任务再试。";
/** 错误响应是「磁盘空间不够」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export function insufficientStorageErrorFromPayload(status, payload, url) {
    const p = (isObject(payload) ? payload : {});
    if (p.error?.details?.reason !== INSUFFICIENT_STORAGE)
        return null;
    const error = attachErrorDetails(new Error(INSUFFICIENT_STORAGE_MESSAGE), payload);
    error.name = "InsufficientStorageError";
    error.status = status;
    if (url)
        error.url = url;
    return error;
}
export function isInsufficientStorageError(error) {
    return !!error && typeof error === "object" && error.reason === INSUFFICIENT_STORAGE;
}
/** 排队（还没开跑）的任务已经满了：建任务、原地重跑回 429，error.details.reason 是这个。message 同样是英文。 */
export const QUEUE_FULL = "queue_full";
export const QUEUE_FULL_MESSAGE = "排队的任务太多了，等前面的开跑再交。";
/** 错误响应是「排队满了」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export function queueFullErrorFromPayload(status, payload, url) {
    const p = (isObject(payload) ? payload : {});
    if (p.error?.details?.reason !== QUEUE_FULL)
        return null;
    const error = attachErrorDetails(new Error(QUEUE_FULL_MESSAGE), payload);
    error.name = "QueueFullError";
    error.status = status;
    if (url)
        error.url = url;
    return error;
}
export function isQueueFullError(error) {
    return !!error && typeof error === "object" && error.reason === QUEUE_FULL;
}
/** 正在恢复数据库备份（只有几秒）：上传、建任务、原地重跑回 409，error.details.reason 是这个，被拒时什么都没写。message 同样是英文。 */
export const RESTORE_IN_PROGRESS = "restore_in_progress";
export const RESTORE_IN_PROGRESS_MESSAGE = "正在恢复备份，稍等再试。";
/** 错误响应是「正在恢复备份」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export function restoreInProgressErrorFromPayload(status, payload, url) {
    const p = (isObject(payload) ? payload : {});
    if (p.error?.details?.reason !== RESTORE_IN_PROGRESS)
        return null;
    const error = attachErrorDetails(new Error(RESTORE_IN_PROGRESS_MESSAGE), payload);
    error.name = "RestoreInProgressError";
    error.status = status;
    if (url)
        error.url = url;
    return error;
}
export function isRestoreInProgressError(error) {
    return !!error && typeof error === "object" && error.reason === RESTORE_IN_PROGRESS;
}
/**
 * 提交被拒但不是故障：页数额度不够、磁盘空间不够、排队的任务满了、正在恢复备份。message 是能照着做的中文，
 * 界面原样显示，不加「提交失败: 状态码」前缀，也不给诊断。都不是就返回 null。
 */
export function refusedSubmissionError(status, payload, url) {
    return pageQuotaErrorFromPayload(status, payload, url)
        ?? insufficientStorageErrorFromPayload(status, payload, url)
        ?? queueFullErrorFromPayload(status, payload, url)
        ?? restoreInProgressErrorFromPayload(status, payload, url);
}
export function isRefusedSubmission(error) {
    return isPageQuotaError(error) || isInsufficientStorageError(error) || isQueueFullError(error)
        || isRestoreInProgressError(error);
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
            const refused = refusedSubmissionError(resp.status, errorPayload, url);
            if (refused)
                throw refused;
            const error = new Error(`提交失败: ${resp.status} ${errorPayload.message || JSON.stringify(errorPayload)}${requestContext}`);
            error.status = resp.status;
            error.url = url;
            throw attachErrorDetails(error, errorPayload);
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
            const refused = refusedSubmissionError(xhr.status, xhr.response, url);
            if (refused) {
                reject(refused);
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
