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
export interface SubmitJsonOptions {
    /** 超过该毫秒数就 abort。省略或 <=0 表示不设超时（保持既有调用方行为）。 */
    timeoutMs?: number;
    /** 超时后抛出的文案，便于调用方给出场景化提示。 */
    timeoutMessage?: string;
}
export declare function submitJson(url: string, payload: unknown, options?: SubmitJsonOptions): Promise<any>;
export declare function submitUploadRequest(url: string, form: FormData, onProgress?: (loaded: number, total: number) => void): Promise<any>;
export declare function fetchProtected(url: string, options?: RequestInit): Promise<Response>;
