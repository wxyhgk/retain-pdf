import type { ReaderRegion } from "../../shared/data/reader-regions.js";
export type ReaderBookmarkControlProps = {
    scope: string;
    currentPage: number;
    numPages: number;
    regions?: readonly ReaderRegion[];
};
export declare function BookmarkIcon({ filled }: {
    filled: boolean;
}): import("react").JSX.Element;
export declare function ReaderBookmarkControl({ scope, currentPage, numPages, regions }: ReaderBookmarkControlProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderBookmarkControl.d.ts.map