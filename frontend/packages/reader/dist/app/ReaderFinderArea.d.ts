import type { ReactElement } from "react";
import type { ReaderIssueNav } from "../hooks/use-reader-issues.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { ReaderFinderState } from "./use-reader-finder.js";
export declare function ReaderFinderArea({ state, bookmarks, bookmarkScope, issues }: {
    state: ReaderFinderState;
    bookmarks: PdfOutlineNode[];
    /** 书签按这本书存（和阅读位置同一个 scope）；空的就没有「书签」页签。 */
    bookmarkScope: string;
    /** 待处理（阅读页拿的那一份）；没有就没有这个页签。 */
    issues: ReaderIssueNav;
}): ReactElement | null;
//# sourceMappingURL=ReaderFinderArea.d.ts.map