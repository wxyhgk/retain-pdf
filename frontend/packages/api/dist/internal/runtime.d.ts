export declare const API_PREFIX = "/api/v1";
export declare function getRuntimeConfig(): any;
export declare function apiBase(): string;
export declare function buildApiUrl(apiPrefix: string | undefined, relativePath: string): string;
export declare function frontendApiKey(): string;
export declare function buildApiHeaders(headers?: Record<string, string>): Record<string, string>;
export type ApiAuthMode = "single" | "multi";
export declare function setApiAuthMode(mode: ApiAuthMode): void;
export declare function getApiAuthMode(): ApiAuthMode;
/** 多用户模式下任何请求回 401（登录过期、被管理员踢下线）时调用；登录接口自己的 401 不算。 */
export declare function setApiUnauthorizedHandler(handler: (() => void) | null): void;
/** 本包所有请求都走这里：按当前模式补上 credentials，统一接住 401。 */
export declare function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
export declare function unwrapEnvelope<T>(envelope: any): T;
export { stripOcrSuffix } from "../utils/strip-ocr.js";
