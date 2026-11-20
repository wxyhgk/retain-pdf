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
/**
 * 阅读页显示用的译文 PDF 不要水印：后端 2026-11-20 起 `translated.pdf` 默认每页右下角带「logo + RetainPDF」水印
 * （给下载用），加 `watermark=0` 取原版。只给显示用；下载菜单走 dialog runtime-port 的 currentArtifactUrls，照旧带水印。
 */
export declare function withoutExportWatermark(url: string): string;
export declare function resolveReaderTranslatedPdfUrl(jobPayload: any, manifestPayload: any, { resolveJobActions, findReadyManifestArtifact, resolveReaderArtifactUrl, resolveResourceUrl, }?: {
    resolveJobActions?: typeof defaultResolveJobActions;
    findReadyManifestArtifact?: typeof defaultFindReadyManifestArtifact;
    resolveReaderArtifactUrl?: typeof defaultResolveReaderArtifactUrl;
    resolveResourceUrl?: (v: unknown) => string;
}): string;
export {};
//# sourceMappingURL=resource-resolver.d.ts.map