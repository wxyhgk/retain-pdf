import type { ReaderRegion } from "../../shared/data/reader-regions.js";
export type ReaderBookmarkControlProps = {
    scope: string;
    currentPage: number;
    numPages: number;
    regions?: readonly ReaderRegion[];
};
/** 书签图标：加过书签的页填实。 */
export declare function BookmarkIcon({ filled }: {
    filled: boolean;
}): import("react").JSX.Element;
export declare function ReaderBookmarkControl({ scope, currentPage, numPages, regions }: ReaderBookmarkControlProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderBookmarkControl.d.ts.map