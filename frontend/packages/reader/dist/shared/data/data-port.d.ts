export declare function createReaderDataPort({ apiPrefix, loadJob, loadManifest, loadMarkdown, loadMarkdownDocument, loadAiChat, loadRegions, loadMetadata, loadTranslationItem, fetchProtectedResource, }?: {
    apiPrefix?: string;
    loadJob?: (jobId: string, apiPrefix: string) => Promise<unknown>;
    loadManifest?: (jobId: string, apiPrefix: string) => Promise<unknown>;
    loadMarkdown?: (jobId: string, apiPrefix: string) => Promise<unknown>;
    loadMarkdownDocument?: (jobId: string, apiPrefix: string) => Promise<unknown>;
    loadAiChat?: (jobId: string, payload: unknown, apiPrefix: string) => Promise<unknown>;
    loadRegions?: (jobId: string, apiPrefix: string) => Promise<unknown>;
    loadMetadata?: (jobId: string, apiPrefix: string) => Promise<unknown>;
    loadTranslationItem?: (jobId: string, itemId: string, apiPrefix: string) => Promise<unknown>;
    fetchProtectedResource?: typeof fetch;
}): Readonly<{
    apiPrefix: string;
    fetchProtected: typeof fetch;
    fetchRegionTranslationItem: (jobId: string, itemId: string) => Promise<unknown>;
    loadMarkdownPayload: (jobId: string) => Promise<any>;
    loadJobPayload: (jobId: string) => Promise<unknown>;
    loadReaderPayload: (jobId: string) => Promise<{
        jobPayload: unknown;
        manifestPayload: unknown;
        readerMetadata: any;
        regionsPayload: any;
    }>;
    submitAiChat: (jobId: string, payload: unknown) => Promise<unknown>;
}>;
export declare const defaultReaderDataPort: Readonly<{
    apiPrefix: string;
    fetchProtected: typeof fetch;
    fetchRegionTranslationItem: (jobId: string, itemId: string) => Promise<unknown>;
    loadMarkdownPayload: (jobId: string) => Promise<any>;
    loadJobPayload: (jobId: string) => Promise<unknown>;
    loadReaderPayload: (jobId: string) => Promise<{
        jobPayload: unknown;
        manifestPayload: unknown;
        readerMetadata: any;
        regionsPayload: any;
    }>;
    submitAiChat: (jobId: string, payload: unknown) => Promise<unknown>;
}>;
//# sourceMappingURL=data-port.d.ts.map