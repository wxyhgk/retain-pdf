import { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope } from "./internal/runtime.js";
export { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope };
export { apiFetch, getApiAuthMode, setApiAuthMode, setApiUnauthorizedHandler, type ApiAuthMode, } from "./internal/runtime.js";
export { API_PREFIX } from "./internal/runtime.js";
export declare function buildApiEndpoint(apiPrefix: string | undefined, relativePath?: string): string;
export declare function buildJobsEndpoint(apiPrefix: string | undefined, scope?: string): string;
export declare function buildJobDetailEndpoint(jobId: string, apiPrefix: string | undefined): string;
export interface HttpError extends Error {
    status?: number;
    url?: string;
    /** true 表示被 submitJson 的 timeoutMs 中止，而非对端返回了错误。 */
    timedOut?: boolean;
}
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
export interface SubmitJsonOptions {
    /** 超过该毫秒数就 abort。省略或 <=0 表示不设超时（保持既有调用方行为）。 */
    timeoutMs?: number;
    /** 超时后抛出的文案，便于调用方给出场景化提示。 */
    timeoutMessage?: string;
}
export declare function submitJson(url: string, payload: unknown, options?: SubmitJsonOptions): Promise<any>;
export declare function submitUploadRequest(url: string, form: FormData, onProgress?: (loaded: number, total: number) => void): Promise<any>;
export declare function fetchProtected(url: string, options?: RequestInit): Promise<Response>;
