export type ReaderFavorite = {
    id: string;
    /** 选的那段字（已经收拾过断行、连字符，selection-text.ts）。 */
    text: string;
    page: number;
    pane: "source" | "translated";
    createdAt: string;
};
type StorageLike = Pick<Storage, "getItem" | "setItem">;
/** 一条最多存这么多字（整页整章地选也只存开头）。 */
export declare const FAVORITE_TEXT_LIMIT = 2000;
/** 新收的在前。 */
export declare function readReaderFavorites(scope: string, storage?: StorageLike | null): ReaderFavorite[];
/** 这本书的收藏变了就调 listener（浮条、右键收了一段，左下角的列表跟着变）；返回取消订阅。 */
export declare function subscribeReaderFavorites(scope: string, listener: () => void): () => void;
/** 同一页同一段字收过就不再收一份（返回已有的那条）。 */
export declare function findReaderFavorite(favorites: readonly ReaderFavorite[], text: string, page: number): ReaderFavorite | null;
export declare function addReaderFavorite(scope: string, entry: {
    text: string;
    page: number;
    pane: "source" | "translated";
}, { storage, now, makeId }?: {
    storage?: StorageLike | null;
    now?: () => string;
    makeId?: () => string;
}): ReaderFavorite[];
export declare function removeReaderFavorite(scope: string, id: string, storage?: StorageLike | null): ReaderFavorite[];
export {};
//# sourceMappingURL=reader-favorites.d.ts.map