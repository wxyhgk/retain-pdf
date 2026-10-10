export type ReaderBookmark = {
    page: number;
    /** 加书签时这一页所在的标题（没有就空），列表里用来认页。 */
    label: string;
    createdAt: string;
};
type StorageLike = Pick<Storage, "getItem" | "setItem">;
/** 按页码从小到大，同一页只留一个。 */
export declare function readReaderBookmarks(scope: string, storage?: StorageLike | null): ReaderBookmark[];
/** 这一页有书签就去掉，没有就加上；返回新的列表。 */
export declare function toggleReaderBookmark(scope: string, page: number, label?: string, { storage, now }?: {
    storage?: StorageLike | null;
    now?: () => string;
}): ReaderBookmark[];
export declare function removeReaderBookmark(scope: string, page: number, storage?: StorageLike | null): ReaderBookmark[];
type HeadingLike = {
    regionType?: string;
    source?: {
        page?: number;
        text?: string;
    };
    translated?: {
        page?: number;
        text?: string;
    };
    markdown?: string;
    readingOrder?: number;
};
/** 这一页所在的章节：本页或之前最近的一个标题（译文优先）。没有标题时返回空串。 */
export declare function bookmarkLabelForPage(regions: readonly HeadingLike[] | null | undefined, page: number): string;
export {};
//# sourceMappingURL=reader-bookmarks.d.ts.map