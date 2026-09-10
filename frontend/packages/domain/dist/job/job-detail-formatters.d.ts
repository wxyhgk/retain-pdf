export declare function firstJobIdFromPayload(payload: unknown): string;
export declare function summarizeResumePlan(plan: {
    can_resume?: unknown;
    reason?: unknown;
    from_stage?: unknown;
    resume_from?: unknown;
    resume_workflow?: unknown;
    workflow?: unknown;
    reruns_stages?: unknown;
} | null | undefined): string;
export declare function summarizeMathMode(job: {
    request_payload_math_mode?: unknown;
} | null | undefined): string;
export declare function formatSizeBytes(value: unknown): string;
export declare function truncatePreview(value: unknown, maxChars?: number): string;
export declare function summarizeArtifactLabel(key: unknown): string;
export declare function firstDefinedValue(...values: unknown[]): unknown;
export declare function stringifyDebugValue(value: unknown): string;
export declare function resolveMarkdownImagesBaseUrl(job: unknown, markdownPayload: {
    images_base_url?: unknown;
    images_base_path?: unknown;
} | null | undefined): string;
export declare function isMarkdownReady(job: unknown): boolean;
