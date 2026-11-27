import { type ReaderBookmark } from "../shared/state/reader-bookmarks.js";
import type { ReaderRegion } from "../shared/data/reader-regions.js";
export declare function useReaderBookmarks(scope: string, regions?: readonly ReaderRegion[]): {
    bookmarks: ReaderBookmark[];
    toggle: (page: number) => void;
    remove: (page: number) => void;
};
//# sourceMappingURL=use-reader-bookmarks.d.ts.map