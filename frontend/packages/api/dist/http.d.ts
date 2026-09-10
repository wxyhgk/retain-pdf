import { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope } from "./internal/runtime.js";
export { apiBase, buildApiHeaders, buildApiUrl, frontendApiKey, unwrapEnvelope };
export { API_PREFIX } from "./internal/runtime.js";
export declare function buildApiEndpoint(apiPrefix: string | undefined, relativePath?: string): string;
export declare function buildJobsEndpoint(apiPrefix: string | undefined, scope?: string): string;
export declare function buildJobDetailEndpoint(jobId: string, apiPrefix: string | undefined): string;
export interface HttpError extends Error {
    status?: number;
    url?: string;
}
export declare function submitJson(url: string, payload: unknown): Promise<any>;
export declare function submitUploadRequest(url: string, form: FormData, onProgress?: (loaded: number, total: number) => void): Promise<any>;
export declare function fetchProtected(url: string, options?: RequestInit): Promise<Response>;
