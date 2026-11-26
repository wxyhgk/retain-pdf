/** 提问窗里跟「一直延续的对话」有关的几块（2026-11-26 主对话）：插进 Thread 的插槽，数据从 AskConversationContext 拿。
 *
 * - 输入框上面：这一问带的出处（「第 56 页 · 选中 37 字」，× 去掉；点开看引的那段）。宿主在发问那一刻读，发出去以后清掉。
 * - 问题上面：这一问问的是哪儿（小标签，点了回到那一处）。
 * - 消息最上面：「看更早的」。
 * - 回答底下：「深挖」（开副对话）；副对话的结论卡片能「看副对话」。
 * - 回答正文下面：agent 这一轮记下的记忆画成「已记住：……（撤销）」（工具卡片收起来也看得到）；压缩点画一条分隔线。
 */
import { type ReactElement } from "react";
import type { AskContext, AskMemoryNotice, AskMessageContext } from "../contract.js";
export type AskConversationUi = {
    /** 下一问要带的出处；没有是 null。 */
    pending: AskContext | null;
    clearPending?: () => void;
    /** 发出去的问题问的是哪儿（按消息编号）。 */
    contexts: ReadonlyMap<string, AskMessageContext>;
    showContext?: (context: AskMessageContext) => void;
    /** 「看更早的」；没有更早的是 null。 */
    earlier?: {
        loading: boolean;
        load: () => void;
    } | null;
    /** 「深挖」：从这条回答开副对话。 */
    fork?: (message: {
        id?: string;
        text: string;
    }) => void;
    /** 结论卡片的「看副对话」。 */
    openSide?: (sideId: string) => void;
    /** 「已记住」的撤销。 */
    forget?: (memoryId: string) => Promise<void>;
};
export declare const AskConversationContext: import("react").Context<AskConversationUi>;
/** 出处标签上的字：「第 56 页 · 选中 37 字」。 */
export declare function contextChipText(context: AskContext | AskMessageContext): string;
/** 输入框上面：下一问带的出处。 */
export declare function PendingContextBar(): ReactElement | null;
/** 问题上面：这一问问的是哪儿。 */
export declare function QuestionContextTag(): ReactElement | null;
/** 消息最上面：「看更早的」。 */
export declare function EarlierHistory(): ReactElement | null;
/** 回答正文下面：这一轮记下的记忆（工具卡片的 artifact.memory）、压缩点。 */
export declare function MessageAfter(): ReactElement | null;
/** 回答底下：「深挖」、结论卡片的「看副对话」。 */
export declare function ConversationFooter(): ReactElement | null;
/** 工具卡片：「已记住：……（撤销）」。 */
export declare function MemoryNotice({ memory }: {
    memory: AskMemoryNotice;
}): ReactElement;
