import type { ReaderRegion } from "../../shared/data/reader-regions.js";
export type ReaderBookmarkControlProps = {
    scope: string;
    currentPage: number;
    numPages: number;
    regions?: readonly ReaderRegion[];
    onGoToPage?: (page: number) => void;
};
export declare function ReaderBookmarkControl({ scope, currentPage, numPages, regions, onGoToPage }: ReaderBookmarkControlProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderBookmarkControl.d.ts.map