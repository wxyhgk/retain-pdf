export declare const SOFT_READER_HISTORY_FLAG = "retainpdfSoftReader";
export declare const SOFT_READER_OPEN_EVENT = "retainpdf:soft-reader-open";
export declare const SOFT_READER_FORCE_CLOSE_EVENT = "retainpdf:soft-reader-force-close";
export declare const SOFT_READER_CLOSE_MESSAGE = "retainpdf:soft-reader-close";
export type SoftReaderHistoryState = {
    [SOFT_READER_HISTORY_FLAG]?: boolean;
    readerUrl?: string;
};
export declare function isHomeDocumentPath(pathname?: string): boolean;
export declare function isSoftReaderHistoryState(state: unknown): state is SoftReaderHistoryState;
export declare function isHomeSpaAlive(doc?: Document): boolean;
export declare function trySoftOpenReader(url: string): boolean;
export declare function closeSoftReaderOnHost(): void;
//# sourceMappingURL=soft-reader.d.ts.map