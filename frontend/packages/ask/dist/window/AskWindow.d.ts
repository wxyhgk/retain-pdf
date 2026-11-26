/** 提问窗（@retainpdf/ask/window；宿主懒加载这一块）。
 *
 * - 窗口：react-rnd。三种摆法：浮动（标题栏拖动、边角调大小）、贴右边（占满右侧，左边框拖宽窄）、放大；双击标题栏放大 / 还原。
 *   Esc / ✕ 关。标题栏见 AskHeader.tsx（图标为主），顶上引的那段见 AskQuote.tsx（公式渲染、展开、原文 / 译文）。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（../ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（../acp/adapter.ts）。
 * - 我们往里塞的几块在 blocks.tsx：工具调用一行一个、工具分组的图标、计划 / 子 agent、「在想…」、用量（图标）、常问。
 * - 回答和工具调用里的页码能点（page-citations.ts、AskPageLink.tsx），点了交给宿主跳页。
 * 宿主给什么、能改什么：见包的 README.md。
 */
import { type ReactElement } from "react";
import type { AskContext, AskMessage, AskPort } from "../contract.js";
export { ASK_IMAGE_MAX_BYTES, ASK_IMAGE_TYPES, ASK_SLOW_HINT_MS } from "./blocks.js";
export type AskWindowProps = {
    port: AskPort;
    /** 问的是哪儿（标题栏页码、顶上引的那段、发给 agent 的出处）。 */
    context: AskContext;
    onClose: () => void;
    /** 点标题栏的页码：回到问的那一处。 */
    onShowContext?: () => void;
    /** 这一处之前的问答（宿主存的），接着显示。 */
    initialMessages?: readonly AskMessage[];
    /** 每答完一轮：整段问答交出去存。 */
    onTurnDone?: (messages: AskMessage[], agentId: string) => void;
    /** 删掉这次提问。不给就没有删除按钮。 */
    onDelete?: () => void;
    /** 回答里的页码点了跳到那一页。不给页码就不能点。 */
    onJumpToPage?: (page: number) => void;
    /** 一共几页（越界的数字不当页码）；0 是不知道。 */
    pageCount?: number;
    /** KaTeX 样式表的地址（宿主自己托管字体）；不给就不插，公式靠宿主页面已有的样式。 */
    katexStylesheetUrl?: string;
};
export default function AskWindow({ port, context, onClose, onShowContext, initialMessages, onTurnDone, onDelete, onJumpToPage, pageCount, katexStylesheetUrl }: AskWindowProps): ReactElement;
