import type { ReactElement } from "react";
import { type ReaderIssueNav } from "../../hooks/use-reader-issues.js";
import type { ReaderRegion } from "../../shared/data/reader-regions.js";
export declare function ReaderBookmarkList({ scope, regions, currentPage, numPages, onJumpPage }: {
    scope: string;
    regions?: readonly ReaderRegion[];
    currentPage: number;
    numPages: number;
    onJumpPage: (page: number) => void;
}): ReactElement;
export declare function ReaderIssueList({ nav }: {
    nav: ReaderIssueNav;
}): ReactElement;
//# sourceMappingURL=ReaderSidebarLists.d.ts.map