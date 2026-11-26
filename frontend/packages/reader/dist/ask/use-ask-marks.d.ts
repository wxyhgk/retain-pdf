import type { AskConversationMessageRecord } from "@retainpdf/api/ai";
import type { ReaderAskPort } from "../contracts/ask.js";
import type { AskMark } from "./ReaderAskMarks.js";
export type AskPointOf = (itemId: string | null, pane: "source" | "translated", page: number) => {
    x: number;
    y: number;
} | null;
/** 主对话里的一问 → 书页上的「?」；没有页码的不画。 */
export declare function recordMark(record: AskConversationMessageRecord, key: number, pointOf: AskPointOf): AskMark | null;
export declare function useAskMarks({ port, documentId, resetKey, pointOf }: {
    port: ReaderAskPort | null;
    documentId: string;
    resetKey: string;
    pointOf: AskPointOf;
}): {
    marks: AskMark[];
    addRecords: (records: readonly AskConversationMessageRecord[]) => void;
    removeMark: (key: number) => void;
};
//# sourceMappingURL=use-ask-marks.d.ts.map