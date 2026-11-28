import type { BootState } from "./types.js";
export declare function normalizeJobStatus(jobPayload: unknown): string;
export declare function resolveJobDocumentId(jobPayload: unknown): string;
export declare function buildCommittedDocumentSourceUrl(documentId: string, revision: string): string;
export declare function isJobIdLikeTitle(title: string, jobId?: string): boolean;
/**
 * 顶栏书名。后端任务详情（GET /jobs/:id）顶层没有书名，书名在 book_summary.title（书库里显示的那个，可能是自动认出的论文标题；
 * 没有时后端填任务号，由 isJobIdLikeTitle 滤掉）。2026-11-28 以前漏读它：只有带上传记录的任务才有 source_file_name，
 * 重排版、续跑出来的任务顶栏没有书名，左边一片空。
 */
export declare function pickDisplayTitle(jobPayload: Record<string, unknown> | null | undefined, jobId: string): string;
export declare function postProgress({ percent, text, stage, }: {
    percent: number;
    text: string;
    stage: string;
}): void;
export declare function setBootProgress(setBoot: (value: BootState | ((prev: BootState) => BootState)) => void, percent: number, text: string, stage?: string): void;
//# sourceMappingURL=session-helpers.d.ts.map