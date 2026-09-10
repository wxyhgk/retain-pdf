import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
export type ReaderRequestScope = "document" | "selection" | "page";
export type ReaderRequestSnapshot = {
    assistantMode: ReaderAssistantMode;
    scope: ReaderRequestScope;
    context: Record<string, unknown> | null;
};
export declare const LEGACY_REQUEST_SNAPSHOT: ReaderRequestSnapshot;
export declare function requestSnapshotKey(jobId: string, assistantMessageId: string): string;
export declare function normalizeRequestSnapshot(value: unknown): ReaderRequestSnapshot | null;
export declare function saveReaderRequestSnapshot(jobId: string, assistantMessageId: string, snapshot: ReaderRequestSnapshot): void;
export declare function loadReaderRequestSnapshot(jobId: string, assistantMessageId: string): ReaderRequestSnapshot | null;
/** Preferred scope key: document-scoped snapshots stay stable across job/document id forms. */
export declare function requestSnapshotScopeKey(options: {
    documentId?: string;
    documentIdRef?: string;
    jobId: string;
}): string;
/** Load the frozen snapshot for a retry, with jobId fallback and legacy default. */
export declare function loadRetryRequestSnapshot(options: {
    scopeKey: string;
    jobId: string;
    assistantMessageId: string;
}): ReaderRequestSnapshot;
export type ReaderSelectionContextInput = Record<string, unknown> | null;
/**
 * Build the frozen snapshot for a new submission.
 * Reading keeps the live selection; operations are always document-scoped
 * with no selection context so an operation can never inherit a quote.
 */
export declare function buildReaderRequestSnapshot(options: {
    assistantMode: ReaderAssistantMode;
    selectionContext: ReaderSelectionContextInput;
}): ReaderRequestSnapshot;
//# sourceMappingURL=reader-request-snapshots.d.ts.map