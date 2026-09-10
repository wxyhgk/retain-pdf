export declare const READER_DOWNLOAD_ACTIONS: Readonly<{
    source: {
        fallbackSuffix: string;
        label: string;
        operation: string;
    };
    sideBySide: {
        fallbackSuffix: string;
        label: string;
        operation: string;
    };
    translated: {
        fallbackSuffix: string;
        label: string;
        operation: string;
    };
}>;
export declare function trimString(value: unknown): string;
export declare function readerDownloadNameState({ jobId, jobPayload, manifestPayload }?: {
    jobId?: string;
    jobPayload?: unknown;
    manifestPayload?: unknown;
}): {
    currentJobId: string;
    currentJobManifest: unknown;
    currentJobManifestJobId: string;
    currentJobSnapshot: unknown;
};
export declare function disabledReason(action: string, urls: any): "下载地址暂不可用" | "原始 PDF 尚未生成或清单不可用" | "对照 PDF 需要原始 PDF 和译文 PDF 都可用" | "译文 PDF 尚未生成或清单不可用";
export interface ReaderDownloadResolverOptions {
    resolveSourcePdfDownloadName?: (state: any, fallbackName: string) => string;
    resolveTranslatedPdfDownloadName?: (state: any, fallbackName: string) => string;
    createRuntimePort?: (deps: {
        getCurrentJobId: (state?: unknown) => string;
        getCurrentJobSnapshot: (state?: unknown) => any;
        getCachedManifestFor: (state: unknown, jobId?: unknown) => any;
    }) => {
        currentArtifactUrls: (state: any) => {
            sourcePdf?: string;
            translatedPdf?: string;
            sideBySidePdf?: string;
        };
    };
    resolveSourcePdf?: (manifestPayload: unknown) => unknown;
}
export declare function createReaderDownloadResolver({ resolveSourcePdfDownloadName, resolveTranslatedPdfDownloadName, createRuntimePort, resolveSourcePdf, }?: ReaderDownloadResolverOptions): Readonly<{
    resolveReaderDownloadUrls: ({ jobId, jobPayload, manifestPayload }?: {
        jobId?: string;
        jobPayload?: unknown;
        manifestPayload?: unknown;
    }) => {
        source: any;
        sideBySide: string;
        translated: string;
    };
    resolveReaderDownloadName: (action: string, { jobId, jobPayload, manifestPayload }: {
        jobId: string;
        jobPayload: unknown;
        manifestPayload: unknown;
    }) => string;
    readerDownloadNameState: typeof readerDownloadNameState;
    disabledReason: typeof disabledReason;
    trimString: typeof trimString;
    READER_DOWNLOAD_ACTIONS: Readonly<{
        source: {
            fallbackSuffix: string;
            label: string;
            operation: string;
        };
        sideBySide: {
            fallbackSuffix: string;
            label: string;
            operation: string;
        };
        translated: {
            fallbackSuffix: string;
            label: string;
            operation: string;
        };
    }>;
}>;
export declare const resolveReaderDownloadUrls: ({ jobId, jobPayload, manifestPayload }?: {
    jobId?: string;
    jobPayload?: unknown;
    manifestPayload?: unknown;
}) => {
    source: any;
    sideBySide: string;
    translated: string;
};
export declare const resolveReaderDownloadName: (action: string, { jobId, jobPayload, manifestPayload }: {
    jobId: string;
    jobPayload: unknown;
    manifestPayload: unknown;
}) => string;
//# sourceMappingURL=resolve.d.ts.map