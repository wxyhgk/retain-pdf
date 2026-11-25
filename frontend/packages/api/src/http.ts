// frontend/packages/api/src/http.ts — canonical HTTP primitives (no mock, no window mock branching)
// Mirrors frontend/web/src/js/api/http.ts but pure: uses internal/runtime for apiBase/header/envelope.

import { apiBase, apiFetch, buildApiHeaders, buildApiUrl, frontendApiKey, getApiAuthMode, unwrapEnvelope } from "./internal/runtime.js";

export { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope };
export {
  apiFetch,
  getApiAuthMode,
  setApiAuthMode,
  setApiUnauthorizedHandler,
  type ApiAuthMode,
} from "./internal/runtime.js";
export { API_PREFIX } from "./internal/runtime.js";

export function buildApiEndpoint(apiPrefix: string | undefined, relativePath = ""): string {
  return buildApiUrl(apiPrefix, relativePath);
}

/** 上传 PDF 的地址（POST /uploads）。网页要上传进度，用 XHR 自己发，地址也从这里拿。 */
export function buildUploadsEndpoint(apiPrefix: string | undefined): string {
  return buildApiEndpoint(apiPrefix, "uploads");
}

// 所有任务（含只做 OCR 的）都在 /jobs 下：建、读、取消都不再用 /ocr/jobs。
export function buildJobsEndpoint(apiPrefix: string | undefined): string {
  return buildApiEndpoint(apiPrefix, "jobs");
}

export function buildJobDetailEndpoint(jobId: string, apiPrefix: string | undefined): string {
  return `${buildJobsEndpoint(apiPrefix)}/${encodeURIComponent(jobId)}`;
}

function isObject(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** 建任务失败时附在报错后面的请求摘要（workflow、OCR 服务商、上传编号）。 */
export function summarizeJobRequestContext(payload: unknown): string {
  if (!isObject(payload)) return "";
  const p = payload as Record<string, unknown>;
  const workflow = `${(p.workflow as string) || ""}`.trim();
  const ocr = p.ocr as Record<string, unknown> | undefined;
  const source = p.source as Record<string, unknown> | undefined;
  const provider = `${(ocr?.provider as string) || ""}`.trim();
  const uploadId = `${(source?.upload_id as string) || ""}`.trim();
  const artifactJobId = `${(source?.artifact_job_id as string) || ""}`.trim();
  const parts: string[] = [];
  if (workflow) parts.push(`workflow=${workflow}`);
  if (provider) parts.push(`ocr.provider=${provider}`);
  if (uploadId) parts.push(`source.upload_id=${uploadId}`);
  if (artifactJobId) parts.push(`source.artifact_job_id=${artifactJobId}`);
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

export interface HttpError extends Error {
  status?: number;
  url?: string;
  /** true 表示被 submitJson 的 timeoutMs 中止，而非对端返回了错误。 */
  timedOut?: boolean;
  /** 后端错误里的 error.code（如 "CONFLICT"）。 */
  errorCode?: string;
  /** 后端错误里的 error.details.reason：409 用它说明为什么不允许（job_active、artifacts_missing…）。 */
  reason?: string;
  /** 这次请求在后端日志里的编号（见 attachRequestRef）。 */
  requestRef?: string;
  /** 409 derived_job_active：这个任务已经续跑 / 重试出来、还在排队或在跑的那个任务（error.details.active_job_id）。 */
  activeJobId?: string;
}

/**
 * 这次请求在后端日志里的编号：500 时用信封里的 error.details.error_id（后端日志按它记了完整原因），
 * 别的用回应头 X-Request-ID（每个回应都带，见 docs/api/00-约定/02-认证与错误.md）。跨域时浏览器可能读不到回应头，就是空。
 */
export function requestRefOf(resp: { headers?: { get(name: string): string | null } } | null | undefined, payload: unknown): string {
  const details = (payload as any)?.error?.details;
  const errorId = typeof details?.error_id === "string" ? details.error_id.trim() : "";
  if (errorId) return errorId;
  try {
    return `${resp?.headers?.get?.("x-request-id") || ""}`.trim();
  } catch {
    return "";
  }
}

/**
 * 把请求编号挂到错误上（requestRef）。后端出错（5xx）时还接在提示后面——「…（编号 1a2b3c）」——
 * 用户截图、复制报错时就带着它，凭它能在后端日志里找到这一次请求（issue #156 只有一句「读取术语表失败」，没法查）。
 * 4xx 的提示本身说得清是哪里不对，不加。
 */
export function attachRequestRef<E extends Error>(error: E, resp: { status?: number; headers?: { get(name: string): string | null } } | null | undefined, payload: unknown): E {
  const ref = requestRefOf(resp, payload);
  if (!ref) return error;
  (error as E & { requestRef?: string }).requestRef = ref;
  const status = Number(resp?.status);
  if (status >= 500 && !error.message.includes(ref)) error.message = `${error.message}（编号 ${ref}）`;
  return error;
}

/** 读后端错误信封里的 error.code 和 error.details.reason，挂到错误对象上。 */
export function attachErrorDetails(error: HttpError, errorPayload: any): HttpError {
  const structured = errorPayload?.error && typeof errorPayload.error === "object" ? errorPayload.error : null;
  const code = typeof structured?.code === "string" ? structured.code.trim() : "";
  if (code) error.errorCode = code;
  const reason = typeof structured?.details?.reason === "string" ? structured.details.reason.trim() : "";
  if (reason) error.reason = reason;
  const activeJobId = typeof structured?.details?.active_job_id === "string" ? structured.details.active_job_id.trim() : "";
  if (activeJobId) error.activeJobId = activeJobId;
  return error;
}

/** 409 legacy_job_unsupported：很早的版本做的任务（老的产物目录布局），后端读不了它的产物（2026-11-25 起）。 */
export const LEGACY_JOB_UNSUPPORTED = "legacy_job_unsupported";
export const LEGACY_JOB_UNSUPPORTED_MESSAGE = "这是很早的版本做的任务，读不了它的文件，请重新上传翻译。";

/**
 * 按任务读文件的接口（产物、阅读、报告…）都可能回 legacy_job_unsupported，各处的报错文案是「读取 xx 失败」，
 * 看不出该怎么办。不管调用方给的是哪种文案，都换成同一句能照着做的话，并挂上 reason。
 */
export function explainLegacyJob(error: HttpError, errorPayload: any): HttpError {
  if (errorPayload?.error?.details?.reason !== LEGACY_JOB_UNSUPPORTED) return error;
  error.message = LEGACY_JOB_UNSUPPORTED_MESSAGE;
  error.reason = LEGACY_JOB_UNSUPPORTED;
  return error;
}

/** 多用户按页额度：建任务时余额不够，后端回 402 + 这个错误码，message 是给用户看的中文。 */
export const PAGE_QUOTA_EXCEEDED = "PAGE_QUOTA_EXCEEDED";

export interface PageQuotaError extends HttpError {
  code: typeof PAGE_QUOTA_EXCEEDED;
  /** 这次提交要扣的页数；后端没给时为 null。 */
  requiredPages: number | null;
  /** 当前剩余页数；后端没给时为 null。 */
  balance: number | null;
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? null : n;
}

/**
 * 错误响应是「页数额度不够」就做成 PageQuotaError：message 直接用后端的中文，不加「提交失败: 402」
 * 这类前缀，界面原样显示即可。不是就返回 null，调用方走原来的报错。
 */
export function pageQuotaErrorFromPayload(status: number, payload: unknown, url?: string): PageQuotaError | null {
  const p = (isObject(payload) ? payload : {}) as Record<string, any>;
  const structured: Record<string, any> = isObject(p.error) ? p.error : {};
  const code = `${structured.code || p.code || ""}`.trim().toUpperCase();
  if (code !== PAGE_QUOTA_EXCEEDED) return null;
  const details: Record<string, any> = isObject(structured.details) ? structured.details : {};
  const message = `${p.message || structured.message || ""}`.trim() || "页数额度不够，请联系管理员。";
  const error = new Error(message) as PageQuotaError;
  error.name = "PageQuotaError";
  error.code = PAGE_QUOTA_EXCEEDED;
  error.status = status;
  error.requiredPages = finiteOrNull(details.required_pages);
  error.balance = finiteOrNull(details.balance);
  if (url) error.url = url;
  return error;
}

export function isPageQuotaError(error: unknown): error is PageQuotaError {
  return !!error && typeof error === "object" && (error as { code?: unknown }).code === PAGE_QUOTA_EXCEEDED;
}

/** 数据目录所在的磁盘快满了：上传、建任务、原地重跑回 503，error.details.reason 是这个。后端的 message 是英文，不给用户看。 */
export const INSUFFICIENT_STORAGE = "insufficient_storage";
export const INSUFFICIENT_STORAGE_MESSAGE = "磁盘空间不够，删掉一些任务再试。";

/** 错误响应是「磁盘空间不够」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export function insufficientStorageErrorFromPayload(status: number, payload: unknown, url?: string): HttpError | null {
  const p = (isObject(payload) ? payload : {}) as Record<string, any>;
  if (p.error?.details?.reason !== INSUFFICIENT_STORAGE) return null;
  const error = attachErrorDetails(new Error(INSUFFICIENT_STORAGE_MESSAGE) as HttpError, payload);
  error.name = "InsufficientStorageError";
  error.status = status;
  if (url) error.url = url;
  return error;
}

export function isInsufficientStorageError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as HttpError).reason === INSUFFICIENT_STORAGE;
}

/** 排队（还没开跑）的任务已经满了：建任务、原地重跑回 429，error.details.reason 是这个。message 同样是英文。 */
export const QUEUE_FULL = "queue_full";
export const QUEUE_FULL_MESSAGE = "排队的任务太多了，等前面的开跑再交。";

/** 错误响应是「排队满了」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export function queueFullErrorFromPayload(status: number, payload: unknown, url?: string): HttpError | null {
  const p = (isObject(payload) ? payload : {}) as Record<string, any>;
  if (p.error?.details?.reason !== QUEUE_FULL) return null;
  const error = attachErrorDetails(new Error(QUEUE_FULL_MESSAGE) as HttpError, payload);
  error.name = "QueueFullError";
  error.status = status;
  if (url) error.url = url;
  return error;
}

export function isQueueFullError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as HttpError).reason === QUEUE_FULL;
}

/** 正在恢复数据库备份（只有几秒）：上传、建任务、原地重跑回 409，error.details.reason 是这个，被拒时什么都没写。message 同样是英文。 */
export const RESTORE_IN_PROGRESS = "restore_in_progress";
export const RESTORE_IN_PROGRESS_MESSAGE = "正在恢复备份，稍等再试。";

/** 错误响应是「正在恢复备份」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export function restoreInProgressErrorFromPayload(status: number, payload: unknown, url?: string): HttpError | null {
  const p = (isObject(payload) ? payload : {}) as Record<string, any>;
  if (p.error?.details?.reason !== RESTORE_IN_PROGRESS) return null;
  const error = attachErrorDetails(new Error(RESTORE_IN_PROGRESS_MESSAGE) as HttpError, payload);
  error.name = "RestoreInProgressError";
  error.status = status;
  if (url) error.url = url;
  return error;
}

export function isRestoreInProgressError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as HttpError).reason === RESTORE_IN_PROGRESS;
}

/**
 * 提交被拒但不是故障：页数额度不够、磁盘空间不够、排队的任务满了、正在恢复备份。message 是能照着做的中文，
 * 界面原样显示，不加「提交失败: 状态码」前缀，也不给诊断。都不是就返回 null。
 */
export function refusedSubmissionError(status: number, payload: unknown, url?: string): HttpError | null {
  return pageQuotaErrorFromPayload(status, payload, url)
    ?? insufficientStorageErrorFromPayload(status, payload, url)
    ?? queueFullErrorFromPayload(status, payload, url)
    ?? restoreInProgressErrorFromPayload(status, payload, url);
}

export function isRefusedSubmission(error: unknown): boolean {
  return isPageQuotaError(error) || isInsufficientStorageError(error) || isQueueFullError(error)
    || isRestoreInProgressError(error);
}

export interface SubmitJsonOptions {
  /** 超过该毫秒数就 abort。省略或 <=0 表示不设超时（保持既有调用方行为）。 */
  timeoutMs?: number;
  /** 超时后抛出的文案，便于调用方给出场景化提示。 */
  timeoutMessage?: string;
}

export async function submitJson(
  url: string,
  payload: unknown,
  options: SubmitJsonOptions = {},
): Promise<any> {
  const timeoutMs = Number(options.timeoutMs) || 0;
  // 裸 fetch 没有超时：对端挂起时 promise 永不 settle，调用方的"进行中"状态
  // 就再也回不来（凭据面板的检测按钮曾因此永久卡在灰色）。需要超时的调用方
  // 显式传 timeoutMs，其余调用方行为不变。
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  let resp: Response;
  try {
    resp = await apiFetch(url, {
      method: "POST",
      headers: buildApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    if (controller?.signal.aborted) {
      const error = new Error(
        options.timeoutMessage || `请求超时（${Math.round(timeoutMs / 1000)}s）`,
      ) as HttpError;
      error.url = url;
      error.timedOut = true;
      throw error;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!resp.ok) {
    const requestContext = /\/api\/v1\/jobs(?:$|\?)/.test(url) ? summarizeJobRequestContext(payload) : "";
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorPayload: any = await resp.json();
      const refused = refusedSubmissionError(resp.status, errorPayload, url);
      if (refused) throw refused;
      const error = new Error(`提交失败: ${resp.status} ${errorPayload.message || JSON.stringify(errorPayload)}${requestContext}`) as HttpError;
      error.status = resp.status;
      error.url = url;
      throw attachRequestRef(attachErrorDetails(error, errorPayload), resp, errorPayload);
    }
    const text = await resp.text();
    const error = new Error(`提交失败: ${resp.status} ${text}${requestContext}`) as HttpError;
    error.status = resp.status;
    error.url = url;
    throw attachRequestRef(error, resp, null);
  }
  if (resp.status === 204) return { ok: true };
  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  const text = await resp.text();
  if (!text.trim()) return { ok: true };
  if (!contentType.includes("application/json")) return text;
  return unwrapEnvelope(JSON.parse(text));
}

export function submitUploadRequest(url: string, form: FormData, onProgress?: (loaded: number, total: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    // 多用户模式靠登录 Cookie：带上凭据、不带部署密钥（和 apiFetch 一致）。
    const multi = getApiAuthMode() === "multi";
    xhr.withCredentials = multi;
    const apiKey = multi ? "" : frontendApiKey();
    if (apiKey) xhr.setRequestHeader("X-API-Key", apiKey);

    xhr.upload.addEventListener("progress", (event: ProgressEvent) => {
      if (!onProgress) return;
      if (event.lengthComputable) onProgress(event.loaded, event.total);
      else onProgress(NaN, NaN);
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
      const message = typeof xhr.response === "object" && xhr.response ? ((xhr.response as any).message || JSON.stringify(xhr.response)) : ((xhr as any).responseText || "");
      const error = new Error(`提交失败: ${xhr.status} ${message}`) as HttpError;
      error.status = xhr.status;
      error.url = url;
      reject(error);
    });

    xhr.addEventListener("error", () => {
      const error = new Error(`提交失败: 网络错误。当前 API Base 为 ${apiBase()}，上传地址为 ${url}。请确认本地服务已经启动。`) as HttpError;
      error.url = url;
      reject(error);
    });

    xhr.send(form);
  });
}

export async function fetchProtected(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = buildApiHeaders((options.headers as Record<string, string>) || {});
  return apiFetch(url, { ...options, headers });
}
