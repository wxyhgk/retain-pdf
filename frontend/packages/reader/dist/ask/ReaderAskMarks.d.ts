/** 书页上的「?」：这次打开里问过的地方，书页左边白边里一个小问号，点了重新打开那次问答。
 * 原文、译文两栏都画（两边的页一样大，位置按占整页的比例）。问答记录后端能存以后从后端读。 */
import type { ReactElement } from "react";
import type { ReaderAskAnchor } from "../contracts/ask.js";
export type AskMark = {
    key: number;
    anchor: ReaderAskAnchor;
};
export declare function ReaderAskMarks({ marks, page, height, onOpen, }: {
    marks: readonly AskMark[];
    page: number;
    /** 这一页画出来多高（像素）。 */
    height: number;
    onOpen: (mark: AskMark) => void;
}): ReactElement | null;
//# sourceMappingURL=ReaderAskMarks.d.ts.map