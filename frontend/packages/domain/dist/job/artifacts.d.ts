import type { ArtifactRuntimeState, ArtifactUrlQuery, ArtifactUrlResolveOptions, JobLike, JobPayload, ManifestArtifactItem, ManifestPayload, MarkdownContract } from "./types.js";
export type { ArtifactRuntimeState, ArtifactUrlQuery, ArtifactUrlResolveOptions, JobLike, JobPayload, ManifestArtifactItem, ManifestPayload, MarkdownContract, } from "./types.js";
export declare function resolveOriginalPdfBaseName(state?: ArtifactRuntimeState): string;
export declare function resolveTranslatedPdfDownloadName(state?: ArtifactRuntimeState, fallbackName?: string): string;
export declare function resolveSourcePdfDownloadName(state?: ArtifactRuntimeState, fallbackName?: string): string;
export declare function toAbsoluteApiUrl(value: unknown): string;
export declare function appendResourceQuery(url: unknown, query?: ArtifactUrlQuery): string;
export declare function createArtifactUrlResolver({ resolveApiBase, }?: {
    resolveApiBase?: () => string;
}): Readonly<{
    resolve: (value: unknown, { query }?: {
        query?: ArtifactUrlQuery | null;
    }) => string;
    toAbsolute: (value: unknown, { query }?: {
        query?: ArtifactUrlQuery | null;
    }) => string;
}>;
export declare const defaultArtifactUrlResolver: Readonly<{
    resolve: (value: unknown, { query }?: {
        query?: ArtifactUrlQuery | null;
    }) => string;
    toAbsolute: (value: unknown, { query }?: {
        query?: ArtifactUrlQuery | null;
    }) => string;
}>;
export declare function resolveResourceUrl(value: unknown, options?: ArtifactUrlResolveOptions): string;
export declare function findReadyManifestArtifact(manifestPayload: ManifestPayload | null | undefined, artifactKey: string): ManifestArtifactItem | null;
export declare function hasReadyManifestArtifact(manifestPayload: ManifestPayload | null | undefined, artifactKey: string): boolean;
export declare function resolveManifestArtifactUrl(manifestPayload: ManifestPayload | null | undefined, artifactKey: string, { includeJobDir }?: {
    includeJobDir?: boolean;
}): string;
export declare function resolveJobMarkdownContract(job: JobLike | JobPayload | null | undefined): MarkdownContract;
export declare function resolveMarkdownAssetUrl(imagesBaseUrl: unknown, relativePath: unknown): string;
export declare function collectMarkdownImageRefs(content: unknown): string[];
