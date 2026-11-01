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
/**
 * 这一页放在别的应用里吗（地址带 `?embed=`，例如笔记 Studio 用 iframe 放 RetainPDF，`embed=studio`）。返回它的值，没有是空串。
 * 嵌入时不软开阅读层、关闭也不找父页：整页跳转，外层的 iframe 才知道换了页（Studio 每次加载完重新握手）；
 * 跳到别的页时带着这个参数。
 */
export declare function embeddedIn(search?: string): string;
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