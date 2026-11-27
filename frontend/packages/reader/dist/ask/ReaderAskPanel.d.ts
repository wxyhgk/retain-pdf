/** 阅读页的提问窗：把主对话（use-ask-conversation）、下一问的出处、任务号、跳页、KaTeX 地址接到 @retainpdf/ask 的 AskWindow 上。
 * 单独一块，第一次提问才加载。以前按书存的问答（只读）也用它看。 */
import { type ReactElement } from "react";
import type { AskAttachTool, AskContextOffer } from "@retainpdf/ask";
import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import { type AskBook } from "./conversation-messages.js";
import type { useAskConversation } from "./use-ask-conversation.js";
type AskState = ReturnType<typeof useAskConversation>;
export type ReaderAskPanelProps = {
    port: ReaderAskPort;
    jobId: string;
    bookTitle?: string;
    book: AskBook;
    ask: AskState;
    /** 点问题上面的小标签：回到问的那一处（只认这本书里的）。 */
    onShowSelection?: (selection: {
        page: number;
        pane: "source" | "translated";
    }) => void;
    onJumpToPage?: (page: number) => void;
    pageCount?: number;
    /** 回答底下的「改这段译文」：跳到问的那一块、打开编辑框，draft 是回答里建议的译文（没有是 null）。不给（这本书现在不能改）就没有。 */
    onEditBlock?: ((itemId: string, draft: string | null) => void) | null;
    /** 这一块能不能改（表格这类不能改）。 */
    canEditBlock?: (itemId: string) => boolean;
    /** 已经带着出处时书页上又选了一处：换成它还是再加上它。 */
    contextOffer?: AskContextOffer | null;
    /** 输入框那一行的「带上这一页」。 */
    attachTools?: readonly AskAttachTool[];
    /** 「截一块问」截好的图：id 变了就加进输入框。 */
    attachRequest?: {
        id: number;
        files: readonly File[];
    } | null;
    /** 窗口摆法变了（贴右边时宽多少）：阅读页给书页让出右边。 */
    onLayout?: (layout: {
        mode: string;
        width: number;
    }) => void;
    /** 阅读页右边停着面板（Markdown）：刚停上时贴右边的提问窗变回浮动。 */
    dockTaken?: boolean;
    /** 以前按书存的一次提问（只读看）；给了就不画主对话。 */
    legacy?: {
        anchor: ReaderAskAnchor;
        messages: readonly ReaderAskMessage[];
        onClose: () => void;
        onDelete?: () => void;
    } | null;
};
export default function ReaderAskPanel({ port, jobId, bookTitle, book, ask, onShowSelection, onJumpToPage, pageCount, legacy, onLayout, dockTaken, onEditBlock, canEditBlock, attachTools, attachRequest, contextOffer }: ReaderAskPanelProps): ReactElement;
export {};
//# sourceMappingURL=ReaderAskPanel.d.ts.map