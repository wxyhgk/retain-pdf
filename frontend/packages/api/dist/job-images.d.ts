export declare function buildJobImageCandidateUrls(item?: any, _options?: {
    apiPrefix?: string;
}): string[];
export declare function normalizeJobImageUrl(value: unknown): string;
export declare function fetchJobImageBlob(rawUrl: string): Promise<Blob | null>;
