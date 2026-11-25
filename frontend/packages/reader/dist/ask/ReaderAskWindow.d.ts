/** 阅读页提问的浮动窗口（单独一块，打开时才加载）。
 *
 * - 窗口：react-rnd，标题栏拖动、边角调大小，不出屏幕；Esc / ✕ 关。
 * - 对话：assistant-ui（LocalRuntime + 我们的 ACP 适配，acp-adapter.ts）；回答用 streamdown 渲染（流式 Markdown + KaTeX 公式）。
 * - 思考折叠、工具调用小卡片（要许可时出「允许 / 拒绝」）、计划、子 agent、底下一行用量 / 缓存命中 / 速度 / 用时。
 * 方案：docs/ops/planning/reader-ask/20261125-阅读页提问.md。
 */
import { type ReactElement } from "react";
import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
/** 第一段到之前等多久就补一句「还在等」（本机 agent 起进程、模型排队都可能慢），不说的话像卡住了。 */
export declare const ASK_SLOW_HINT_MS = 10000;
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
};
export default function ReaderAskWindow({ port, jobId, bookTitle, anchor, onClose, onShowAnchor, initialMessages, onTurnDone, onDelete }: ReaderAskWindowProps): ReactElement;
//# sourceMappingURL=ReaderAskWindow.d.ts.map