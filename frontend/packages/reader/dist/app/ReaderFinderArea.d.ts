import type { ReactElement } from "react";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { ReaderFinderState } from "./use-reader-finder.js";
export declare function ReaderFinderArea({ state, bookmarks, bookmarkScope, issuesJobId }: {
    state: ReaderFinderState;
    bookmarks: PdfOutlineNode[];
    /** 书签按这本书存（和阅读位置同一个 scope）；空的就没有「书签」页签。 */
    bookmarkScope: string;
    /** 「待处理」读哪个任务的问题段落；空的就没有。 */
    issuesJobId: string;
}): ReactElement;
//# sourceMappingURL=ReaderFinderArea.d.ts.map