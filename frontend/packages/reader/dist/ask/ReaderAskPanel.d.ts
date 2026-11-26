/** 阅读页的提问窗：把书上的位置、任务号、跳页、KaTeX 地址接到 @retainpdf/ask 的 AskWindow 上。单独一块，第一次提问才加载。 */
import { type ReactElement } from "react";
import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
export type ReaderAskPanelProps = {
    port: ReaderAskPort;
    jobId: string;
    bookTitle?: string;
    anchor: ReaderAskAnchor;
    onClose: () => void;
    /** 点标题栏的页码：跳回问的那一处。 */
    onShowAnchor?: () => void;
    initialMessages?: readonly ReaderAskMessage[];
    onTurnDone?: (messages: ReaderAskMessage[], agentId: string, sessionId?: string) => void;
    onDelete?: () => void;
    onJumpToPage?: (page: number) => void;
    pageCount?: number;
};
export default function ReaderAskPanel({ port, jobId, bookTitle, anchor, onShowAnchor, ...rest }: ReaderAskPanelProps): ReactElement;
//# sourceMappingURL=ReaderAskPanel.d.ts.map