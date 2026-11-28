import { type ReactElement } from "react";
import type { AskConversationRecord } from "@retainpdf/api/ai";
import type { useAskConversation } from "./use-ask-conversation.js";
type AskState = ReturnType<typeof useAskConversation>;
/** 以前的主对话叫什么：有自己的标题写标题，日期是最后一次说话那天。 */
export declare function archivedLabel(record: AskConversationRecord): string;
/** 按钮上写的：现在看的是哪段对话。 */
export declare function conversationLabel(conversation: AskConversationRecord | null | undefined): string;
/** 标题栏左边的「主对话 ▾」。没有按书存的对话（宿主没给接口）时只是一行字。 */
export declare function ReaderAskConversationMenu({ ask, canArchive, canList }: {
    ask: AskState;
    canArchive: boolean;
    canList: boolean;
}): ReactElement;
export {};
//# sourceMappingURL=ReaderAskConversationMenu.d.ts.map