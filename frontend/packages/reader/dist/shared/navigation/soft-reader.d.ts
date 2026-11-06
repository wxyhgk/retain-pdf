export declare const SOFT_READER_HISTORY_FLAG = "retainpdfSoftReader";
export declare const SOFT_READER_OPEN_EVENT = "retainpdf:soft-reader-open";
export declare const SOFT_READER_FORCE_CLOSE_EVENT = "retainpdf:soft-reader-force-close";
export declare const SOFT_READER_CLOSE_MESSAGE = "retainpdf:soft-reader-close";
export type SoftReaderHistoryState = {
    [SOFT_READER_HISTORY_FLAG]?: boolean;
    readerUrl?: string;
};
export type SoftReaderJobHandoff = {
    previousJobId?: string | null;
    nextJobId?: string | null;
    documentId?: string | null;
};
export declare function isHomeDocumentPath(pathname?: string): boolean;
export declare function isSoftReaderHistoryState(state: unknown): state is SoftReaderHistoryState;
export declare function isHomeSpaAlive(doc?: Document): boolean;
export declare function trySoftOpenReader(url: string): boolean;
/**
 * A retry-stage request creates a new immutable job. If the soft Reader is
 * currently showing the retried job (or the same source document), replace
 * its job_id in place and remount the iframe. Query anchors such as page_idx
 * and block_id are intentionally preserved.
 */
export declare function handoffSoftReaderJob({ previousJobId, nextJobId, documentId, }: SoftReaderJobHandoff): boolean;
export declare function closeSoftReaderOnHost(): void;
//# sourceMappingURL=soft-reader.d.ts.map