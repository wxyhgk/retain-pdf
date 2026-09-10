export declare function createFavorite(apiPrefix: string, payload?: Record<string, unknown>): Promise<any>;
export declare function fetchFavorites(apiPrefix: string, { documentId }?: {
    documentId?: string;
}): Promise<any>;
export declare function deleteFavorite(apiPrefix: string, favoriteId: string): Promise<any>;
