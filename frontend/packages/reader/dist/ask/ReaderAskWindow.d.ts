/** 阅读页提问的窗口（单独一块，打开时才加载）。
 *
 * - 窗口：react-rnd。三种摆法：浮动（标题栏拖动、边角调大小）、贴右边（占满右侧，左边框拖宽窄）、放大；双击标题栏放大 / 还原。
 *   Esc / ✕ 关。标题栏见 AskHeader.tsx（图标为主），顶上引的那段见 AskQuote.tsx（公式渲染、展开、原文 / 译文）。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（./ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（acp-adapter.ts）。
 * - 我们往里塞的几块在 ask-blocks.tsx：工具调用一行一个、工具分组的图标、计划 / 子 agent、「在想…」、用量（图标）、常问。
 * - 回答和工具调用里的页码能点（page-citations.ts、AskPageLink.tsx），点了阅读页跳过去。
 * 方案：docs/ops/planning/reader-ask/20261125-阅读页提问.md；说明：docs/core/frontend/reader-ask.md。
 */
import { type ReactElement } from "react";
import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
export { ASK_IMAGE_MAX_BYTES, ASK_IMAGE_TYPES, ASK_SLOW_HINT_MS } from "./ask-blocks.js";
export type ReaderAskWindowProps = {
    port: ReaderAskPort;
    jobId: string;
    bookTitle?: string;
    anchor: ReaderAskAnchor;
    onClose: () => void;
    /** 点出处：跳回问的那一处。 */
    onShowAnchor?: () => void;
    /** 这一处之前的问答（问答记录读回来的，或这次打开里问过的），接着显示。 */
    initialMessages?: readonly ReaderAskMessage[];
    /** 每答完一轮：整段问答交出去存（问答记录）。 */
    onTurnDone?: (messages: ReaderAskMessage[], agentId: string) => void;
    /** 删掉这次提问（书页上的「?」也去掉）。不给就没有删除按钮。 */
    onDelete?: () => void;
    /** 回答里的页码点了跳到那一页。不给页码就不能点。 */
    onJumpToPage?: (page: number) => void;
    /** 这本书有几页（越界的数字不当页码）；0 是不知道。 */
    pageCount?: number;
};
export default function ReaderAskWindow({ port, jobId, bookTitle, anchor, onClose, onShowAnchor, initialMessages, onTurnDone, onDelete, onJumpToPage, pageCount }: ReaderAskWindowProps): ReactElement;
//# sourceMappingURL=ReaderAskWindow.d.ts.map