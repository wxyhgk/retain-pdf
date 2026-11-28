import type { AskContext, AskPort } from "@retainpdf/ask";
import type { AskSelectionInput } from "@retainpdf/api/ai";
import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
/** 第一问前面的出处：一段文字，agent 不管有没有接书的工具都看得懂；带上任务号和块号，接了 retainpdf mcp 的 agent 能自己去读。 */
export declare function anchorPreamble(anchor: ReaderAskAnchor, jobId: string, bookTitle?: string): string;
/** 同一问另外带的几处（「再加一段」）：一段字，认结构化出处的 agent 也照带（_meta 只放得下第一处）。 */
export declare function extraPreamble(extras: readonly ReaderAskAnchor[]): string;
/** selection 给了就放进这一问的 _meta.retainpdf.selection（自带 agent 认结构化出处，追加消息也存它）。extras 是另外带的几处。 */
export declare function toAskContext(anchor: ReaderAskAnchor, jobId: string, bookTitle?: string, selection?: AskSelectionInput, extras?: readonly ReaderAskAnchor[]): AskContext;
/**
 * 阅读页的端口 → 提问窗的端口：开会话时绑上这本书的任务号（自带 agent 拿它读书）和对话编号（自带 agent 自己取前文）。
 * 本机 agent 不认对话：新会话第一问前面带上下文接口拼好的前文（conversationPreamble）。
 */
export declare function bindAskPort(port: ReaderAskPort, jobId: string, conversation?: {
    id: string;
    documentId: string;
} | null): AskPort;
//# sourceMappingURL=ask-context.d.ts.map