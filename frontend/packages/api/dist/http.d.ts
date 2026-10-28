import { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope } from "./internal/runtime.js";
export { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope };
export { apiFetch, getApiAuthMode, setApiAuthMode, setApiUnauthorizedHandler, type ApiAuthMode, } from "./internal/runtime.js";
export { API_PREFIX } from "./internal/runtime.js";
export declare function buildApiEndpoint(apiPrefix: string | undefined, relativePath?: string): string;
/** 上传 PDF 的地址（POST /uploads）。网页要上传进度，用 XHR 自己发，地址也从这里拿。 */
export declare function buildUploadsEndpoint(apiPrefix: string | undefined): string;
export declare function buildJobsEndpoint(apiPrefix: string | undefined): string;
export declare function buildJobDetailEndpoint(jobId: string, apiPrefix: string | undefined): string;
/** 建任务失败时附在报错后面的请求摘要（workflow、OCR 服务商、上传编号）。 */
export declare function summarizeJobRequestContext(payload: unknown): string;
export interface HttpError extends Error {
    status?: number;
    url?: string;
    /** true 表示被 submitJson 的 timeoutMs 中止，而非对端返回了错误。 */
    timedOut?: boolean;
    /** 后端错误里的 error.code（如 "CONFLICT"）。 */
    errorCode?: string;
    /** 后端错误里的 error.details.reason：409 用它说明为什么不允许（job_active、artifacts_missing…）。 */
    reason?: string;
}
/** 读后端错误信封里的 error.code 和 error.details.reason，挂到错误对象上。 */
export declare function attachErrorDetails(error: HttpError, errorPayload: any): HttpError;
/** 多用户按页额度：建任务时余额不够，后端回 402 + 这个错误码，message 是给用户看的中文。 */
export declare const PAGE_QUOTA_EXCEEDED = "PAGE_QUOTA_EXCEEDED";
export interface PageQuotaError extends HttpError {
    code: typeof PAGE_QUOTA_EXCEEDED;
    /** 这次提交要扣的页数；后端没给时为 null。 */
    requiredPages: number | null;
    /** 当前剩余页数；后端没给时为 null。 */
    balance: number | null;
}
/**
 * 错误响应是「页数额度不够」就做成 PageQuotaError：message 直接用后端的中文，不加「提交失败: 402」
 * 这类前缀，界面原样显示即可。不是就返回 null，调用方走原来的报错。
 */
export declare function pageQuotaErrorFromPayload(status: number, payload: unknown, url?: string): PageQuotaError | null;
export declare function isPageQuotaError(error: unknown): error is PageQuotaError;
/** 数据目录所在的磁盘快满了：上传、建任务、原地重跑回 503，error.details.reason 是这个。后端的 message 是英文，不给用户看。 */
export declare const INSUFFICIENT_STORAGE = "insufficient_storage";
export declare const INSUFFICIENT_STORAGE_MESSAGE = "\u78C1\u76D8\u7A7A\u95F4\u4E0D\u591F\uFF0C\u5220\u6389\u4E00\u4E9B\u4EFB\u52A1\u518D\u8BD5\u3002";
/** 错误响应是「磁盘空间不够」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export declare function insufficientStorageErrorFromPayload(status: number, payload: unknown, url?: string): HttpError | null;
export declare function isInsufficientStorageError(error: unknown): boolean;
/** 排队（还没开跑）的任务已经满了：建任务、原地重跑回 429，error.details.reason 是这个。message 同样是英文。 */
export declare const QUEUE_FULL = "queue_full";
export declare const QUEUE_FULL_MESSAGE = "\u6392\u961F\u7684\u4EFB\u52A1\u592A\u591A\u4E86\uFF0C\u7B49\u524D\u9762\u7684\u5F00\u8DD1\u518D\u4EA4\u3002";
/** 错误响应是「排队满了」就做成一句中文的错误（带 status、reason），不是就返回 null。 */
export declare function queueFullErrorFromPayload(status: number, payload: unknown, url?: string): HttpError | null;
export declare function isQueueFullError(error: unknown): boolean;
/**
 * 提交被拒但不是故障：页数额度不够、磁盘空间不够、排队的任务满了。message 是能照着做的中文，
 * 界面原样显示，不加「提交失败: 状态码」前缀，也不给诊断。都不是就返回 null。
 */
export declare function refusedSubmissionError(status: number, payload: unknown, url?: string): HttpError | null;
export declare function isRefusedSubmission(error: unknown): boolean;
export interface SubmitJsonOptions {
    /** 超过该毫秒数就 abort。省略或 <=0 表示不设超时（保持既有调用方行为）。 */
    timeoutMs?: number;
    /** 超时后抛出的文案，便于调用方给出场景化提示。 */
    timeoutMessage?: string;
}
export declare function submitJson(url: string, payload: unknown, options?: SubmitJsonOptions): Promise<any>;
export declare function submitUploadRequest(url: string, form: FormData, onProgress?: (loaded: number, total: number) => void): Promise<any>;
export declare function fetchProtected(url: string, options?: RequestInit): Promise<Response>;
