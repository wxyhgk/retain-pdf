/** 书页上的「?」：这本书上问过的地方，书页左边白边里一个小问号。主对话里的问点了打开主对话；以前按书存的点了只读地看那一次。
 * 原文、译文两栏都画（两边的页一样大，位置按占整页的比例）。问过的地方见 use-ask-marks。 */
import type { ReactElement } from "react";
import type { ReaderAskAnchor } from "../contracts/ask.js";
/** 书页上的一个「?」：问的哪儿；以前按书存的有 threadId，主对话里的有 messageId。 */
export type AskMark = {
    key: number;
    anchor: ReaderAskAnchor;
    threadId?: string;
    messageId?: string;
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