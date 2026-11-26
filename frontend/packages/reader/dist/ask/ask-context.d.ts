import type { AskContext, AskPort } from "@retainpdf/ask";
import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
/** 第一问前面的出处：一段文字，agent 不管有没有接书的工具都看得懂；带上任务号和块号，接了 retainpdf mcp 的 agent 能自己去读。 */
export declare function anchorPreamble(anchor: ReaderAskAnchor, jobId: string, bookTitle?: string): string;
export declare function toAskContext(anchor: ReaderAskAnchor, jobId: string, bookTitle?: string): AskContext;
/** 阅读页的端口 → 提问窗的端口：开会话时绑上这本书的任务号（自带 agent 拿它读书）。 */
export declare function bindAskPort(port: ReaderAskPort, jobId: string): AskPort;
//# sourceMappingURL=ask-context.d.ts.map