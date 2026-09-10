export declare function resolveReaderJobId({ search, isMock, mockJobId, }?: {
    search?: string;
    isMock?: () => boolean;
    mockJobId?: () => string;
}): string;
export declare function resolveReaderDocumentId({ search }?: {
    search?: string;
}): string;
export declare function resolveReaderAnchor({ search }?: {
    search?: string;
}): {
    pageIdx: number | null;
    blockId: string;
} | null;
export declare function createReaderPageConfigPort({ messageTargetOrigin, isMock, mockJobId, search, }?: {
    messageTargetOrigin?: () => string;
    isMock?: () => boolean;
    mockJobId?: () => string;
    search?: () => string;
}): Readonly<{
    messageTargetOrigin: () => string;
    readerJobId: () => string;
}>;
export declare const defaultReaderPageConfigPort: Readonly<{
    messageTargetOrigin: () => string;
    readerJobId: () => string;
}>;
//# sourceMappingURL=page-config.d.ts.map