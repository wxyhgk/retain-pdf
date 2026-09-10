export declare function buildJobImageCandidateUrls(item?: any, { apiPrefix }?: {
    apiPrefix?: string;
}): string[];
export declare function normalizeJobImageUrl(value: unknown): string;
export declare function fetchJobImageBlob(rawUrl: string): Promise<Blob | null>;
