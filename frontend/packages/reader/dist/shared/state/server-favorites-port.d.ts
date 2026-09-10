import type { CreateServerFavoritesPortOptions, FavoriteItem, SelectionQuote, ServerFavorite, ServerFavoriteRaw } from "../types/types.js";
export declare function normalizeServerFavorite(raw?: ServerFavoriteRaw): ServerFavorite | null;
export declare function dedupeServerFavorites(serverFavorites?: ServerFavorite[], localItems?: FavoriteItem[]): ServerFavorite[];
export declare function createReaderServerFavoritesPort({ jobId, apiPrefix, documentByJobId, submitFavorite, loadFavorites, removeFavorite, }?: CreateServerFavoritesPortOptions): Readonly<{
    loadServerFavorites: () => Promise<ServerFavorite[]>;
    recreateFavoriteNote: (annotation?: Partial<ServerFavorite>, note?: string) => Promise<ServerFavorite>;
    removeServerFavorite: (favoriteId: string) => Promise<boolean>;
    resolveDocumentId: () => Promise<string>;
    syncFavorite: (quote?: SelectionQuote) => Promise<import("../types/types.js").FavoriteApiRecord>;
}>;
//# sourceMappingURL=server-favorites-port.d.ts.map