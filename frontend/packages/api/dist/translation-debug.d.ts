export declare function fetchTranslationDiagnostics(jobId: string, apiPrefix?: string): Promise<any>;
export declare function fetchTranslationItems(jobId: string, apiPrefix: string | undefined, { limit, offset, page, finalStatus, errorType, route, q }?: {
    limit?: number;
    offset?: number;
    page?: string;
    finalStatus?: string;
    errorType?: string;
    route?: string;
    q?: string;
}): Promise<any>;
export declare function fetchTranslationItem(jobId: string, itemId: string, apiPrefix?: string): Promise<any>;
export declare function replayTranslationItem(jobId: string, itemId: string, apiPrefix?: string): Promise<any>;
