/** 按段取的大 PDF：总长和取一段的办法（[begin, end)，走带鉴权的 fetch）。 */
export type RangedPdfSource = {
    url: string;
    length: number;
    fetchRange: (begin: number, end: number) => Promise<Uint8Array>;
};
export type ProtectedPdfFile = {
    data: Uint8Array;
} | {
    ranged: RangedPdfSource;
};
/** 这么大以上、服务器认 Range 的 PDF 按段取。 */
export declare const RANGED_PDF_MIN_BYTES: number;
/**
 * PDF.js 会把传入的 ArrayBuffer 转移给 Worker，原 buffer 随后会 detached。
 * 缓存/会话持有的原始字节不能直接交给 Document，否则分栏切换导致重挂载时
 * 无法再次解析。每个 Document 实例只消费自己的副本。
 */
export declare function cloneProtectedPdfFileForWorker(file: ProtectedPdfFile | null): ProtectedPdfFile | null;
type ProtectedPdfState = {
    file: ProtectedPdfFile | null;
    loading: boolean;
    error: string;
};
export declare function loadProtectedPdfFile(url: string, fetchResource?: typeof fetch, options?: {
    signal?: AbortSignal;
}): Promise<ProtectedPdfFile | null>;
export declare function useProtectedPdfFile(url?: string, 
/** 会话已预下载时直接注入，跳过二次请求 */
preloaded?: ProtectedPdfFile | null): ProtectedPdfState;
export {};
//# sourceMappingURL=useProtectedPdfFile.d.ts.map