declare function defaultFindReadyManifestArtifact(manifestPayload: any, artifactKey: string): any | null;
declare function defaultResolveReaderArtifactUrl(item: any, { resolveResourceUrl }?: {
    resolveResourceUrl?: (v: unknown) => string;
}): string;
declare function defaultResolveJobActions(job: any): {
    pdfEnabled?: boolean;
    pdf?: string;
} | null;
export declare function resolveReaderJobId(configPort: any): string;
export declare function resolveReaderSourcePdf(manifestPayload: any, { findReadyManifestArtifact, resolveManifestArtifactUrl: resolveUrl, }?: {
    findReadyManifestArtifact?: typeof defaultFindReadyManifestArtifact;
    resolveManifestArtifactUrl?: (payload: any, key: string) => string;
}): string | any | null;
export declare function resolveReaderTranslatedPdfUrl(jobPayload: any, manifestPayload: any, { resolveJobActions, findReadyManifestArtifact, resolveReaderArtifactUrl, resolveResourceUrl, }?: {
    resolveJobActions?: typeof defaultResolveJobActions;
    findReadyManifestArtifact?: typeof defaultFindReadyManifestArtifact;
    resolveReaderArtifactUrl?: typeof defaultResolveReaderArtifactUrl;
    resolveResourceUrl?: (v: unknown) => string;
}): string;
export {};
//# sourceMappingURL=resource-resolver.d.ts.map