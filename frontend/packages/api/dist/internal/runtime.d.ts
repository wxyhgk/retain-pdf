export declare const API_PREFIX = "/api/v1";
export declare function getRuntimeConfig(): any;
export declare function apiBase(): string;
export declare function buildApiUrl(apiPrefix: string | undefined, relativePath: string): string;
export declare function frontendApiKey(): string;
export declare function buildApiHeaders(headers?: Record<string, string>): Record<string, string>;
export declare function unwrapEnvelope<T>(envelope: any): T;
export { stripOcrSuffix } from "../utils/strip-ocr.js";
