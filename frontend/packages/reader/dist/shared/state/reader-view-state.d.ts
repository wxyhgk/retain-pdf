import type { PageScrollProgress } from "../../pdf/scroll-to-page.js";
export type StoredReaderPaneContent = "source" | "translated" | "markdown" | "ai";
export type StoredReaderSplitLayout = {
    left: StoredReaderPaneContent;
    right: StoredReaderPaneContent;
};
export type ReaderViewState = {
    schema: "retainpdf_reader_view_v1";
    anchor?: PageScrollProgress;
    zoom?: number;
    splitLayout?: StoredReaderSplitLayout | null;
    assistantPanel?: "markdown" | "ai" | null;
    updatedAt: number;
};
type ReaderViewStatePatch = Partial<Pick<ReaderViewState, "anchor" | "zoom" | "splitLayout" | "assistantPanel">>;
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export declare function readerViewStateScope({ documentId, jobId, }: {
    documentId?: unknown;
    jobId?: unknown;
}): string;
export declare function readerViewStateStorageKey(scope: string): string;
export declare function normalizeReaderViewState(value: unknown): ReaderViewState | null;
export declare function loadReaderViewState(scope: string, storage?: StorageLike | null): ReaderViewState | null;
export declare function saveReaderViewState(scope: string, patch: ReaderViewStatePatch, storage?: StorageLike | null): ReaderViewState | null;
export {};
//# sourceMappingURL=reader-view-state.d.ts.map