import type { BuildPdfDocumentOptionsArgs, LoadPdfDocumentArgs } from "../types/types.js";
export declare function resolveReaderArtifactUrl(item: {
    resource_url?: string;
    resource_path?: string;
} | null | undefined, { resolveResourceUrl }?: {
    resolveResourceUrl?: (v: unknown) => string;
}): string;
export declare function buildPdfDocumentOptions({ url, configPort, resolvePdfjsVendorUrl, }?: BuildPdfDocumentOptionsArgs & {
    resolvePdfjsVendorUrl?: (path: string) => string;
}): {
    url: string;
    httpHeaders: any;
    withCredentials: boolean;
    disableRange: boolean;
    disableStream: boolean;
    rangeChunkSize: number;
    cMapUrl: string;
    cMapPacked: boolean;
    standardFontDataUrl: string;
};
export declare function loadPdfDocument({ itemOrUrl, configPort, fetchProtected, resolveResourceUrl, resolvePdfjsVendorUrl, }?: LoadPdfDocumentArgs & {
    resolveResourceUrl?: (v: unknown) => string;
    resolvePdfjsVendorUrl?: (path: string) => string;
}): Promise<any>;
export declare function __resetPdfjsForTests(): void;
//# sourceMappingURL=pdf-document.d.ts.map