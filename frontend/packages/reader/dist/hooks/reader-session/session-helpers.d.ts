import type { BootState } from "./types.js";
export declare const TERMINAL_JOB_STATUSES: Set<string>;
export declare function normalizeJobStatus(jobPayload: unknown): string;
export declare function resolveJobDocumentId(jobPayload: unknown): string;
export declare function buildCommittedDocumentSourceUrl(documentId: string, revision: string): string;
export declare function isJobIdLikeTitle(title: string, jobId?: string): boolean;
export declare function pickDisplayTitle(jobPayload: Record<string, unknown> | null | undefined, jobId: string): string;
export declare function postProgress({ percent, text, stage, }: {
    percent: number;
    text: string;
    stage: string;
}): void;
export declare function setBootProgress(setBoot: (value: BootState | ((prev: BootState) => BootState)) => void, percent: number, text: string, stage?: string): void;
//# sourceMappingURL=session-helpers.d.ts.map