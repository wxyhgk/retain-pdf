/** 书页上的「?」：这次打开里问过的地方，书页左边白边里一个小问号，点了重新打开那次问答。
 * 原文、译文两栏都画（两边的页一样大，位置按占整页的比例）。问过的地方从问答记录读（use-ask-threads）。 */
import type { ReactElement } from "react";
import type { ReaderAskAnchor } from "../contracts/ask.js";
/** 书页上的一个「?」：问的哪儿；存进问答记录以后有 threadId 和标题。 */
export type AskMark = {
    key: number;
    anchor: ReaderAskAnchor;
    threadId?: string;
    title?: string;
};
export declare function ReaderAskMarks({ marks, page, height, onOpen, }: {
    marks: readonly AskMark[];
    page: number;
    /** 这一页画出来多高（像素）。 */
    height: number;
    onOpen: (mark: AskMark) => void;
}): ReactElement | null;
//# sourceMappingURL=ReaderAskMarks.d.ts.map