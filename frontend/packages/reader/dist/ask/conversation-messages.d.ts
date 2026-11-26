import type { AskMemoryNotice, AskMessage, AskMessageContext, AskTurnRecord } from "@retainpdf/ask";
import type { AskCompactionPointView, AskConversationMessageInput, AskConversationMessageRecord, AskMemoryRecord, AskSelectionInput } from "@retainpdf/api/ai";
import type { ReaderAskAnchor } from "../contracts/ask.js";
/** 正在读的书：出处要带的编号。 */
export type AskBook = {
    documentId: string;
    jobId: string;
    versionId: string | null;
};
/** 书上的位置 → 结构化出处（只放有值的；块编号前端认出来的那一块）。 */
export declare function anchorSelection(anchor: ReaderAskAnchor, book: AskBook): AskSelectionInput;
/** 问题上面的小标签：「第 56 页 · 2.1 节」；别的书里问的写「别的书」，点了不跳。 */
export declare function selectionContext(selection: AskConversationMessageRecord["selection"], currentDocumentId: string): AskMessageContext | null;
/** 库里的消息 → 提问窗的消息。side_summary 画成结论卡片；seq 正好是压缩点的那条后面画分隔线。 */
export declare function recordsToMessages(records: readonly AskConversationMessageRecord[], compactions?: readonly Pick<AskCompactionPointView, "covers_to_seq">[], currentDocumentId?: string): AskMessage[];
/** 答完的一轮 → 追加消息的请求。clientId 是这一轮的幂等号前缀（网络重试不会追加两次）。 */
export declare function turnToAppend(turn: AskTurnRecord, documentId: string, clientId: string): AskConversationMessageInput[];
/**
 * agent 不在工具卡片的 _meta 里报记忆（RetainPDF + pi、以后经 retainpdf mcp 的本机 agent）：一轮答完按对话和开始时间查到的，
 * 去掉已经画过的、不是 agent 记的，换成「已记住」。查询的起点往前让 2 秒（后端的时间到秒、两边钟可能差一点）。
 */
export declare function memoriesSince(startedAt: number): string;
export declare function laterMemories(records: readonly AskMemoryRecord[], known: ReadonlySet<string>): AskMemoryNotice[];
/** 「深挖」点的那条回答在库里是哪条：窗口里带着编号就用它；刚答完还没编号的，按正文从后往前找。 */
export declare function findForkSource(records: readonly AskConversationMessageRecord[], message: {
    id?: string;
    text: string;
}): string | null;
/** 副对话的标题：从那条回答的第一句截。 */
export declare function forkTitle(text: string): string;
//# sourceMappingURL=conversation-messages.d.ts.map