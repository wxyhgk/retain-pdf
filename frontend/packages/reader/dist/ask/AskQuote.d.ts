import { type ReactElement } from "react";
import type { ReaderAskAnchor } from "../contracts/ask.js";
export type MathSegment = {
    type: "text" | "math";
    value: string;
};
/** 一段字切成普通字和公式（纯函数，测试用）。 */
export declare function splitMath(text: string): MathSegment[];
export declare function AskQuote({ anchor }: {
    anchor: ReaderAskAnchor;
}): ReactElement | null;
//# sourceMappingURL=AskQuote.d.ts.map