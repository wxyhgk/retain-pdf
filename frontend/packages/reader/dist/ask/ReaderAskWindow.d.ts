/** 阅读页提问的浮动窗口（单独一块，打开时才加载）。
 *
 * - 窗口：react-rnd，标题栏拖动、边角调大小，不出屏幕；Esc / ✕ 关。
 * - 对话：整套照搬 assistant-ui 官方的 Thread（./ui/elements/thread.aui.tsx：复制、重新回答、改问题、版本切换、回到最下面、
 *   Markdown + KaTeX、思考、工具调用分组、许可），runtime 是 LocalRuntime + 我们的 ACP 适配（acp-adapter.ts）。
 * - 我们只往里塞：工具调用（ACP 的许可换成它的 approval）、计划 / 子 agent 的数据块、「在想…」、回答底下的用量那一行。
 * 方案：docs/ops/planning/reader-ask/20261125-阅读页提问.md；说明：docs/core/frontend/reader-ask.md。
 */
import { type ReactElement } from "react";
import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
/** 第一段到之前等多久就补一句「还在等」（本机 agent 起进程、模型排队都可能慢），不说的话像卡住了。 */
export declare const ASK_SLOW_HINT_MS = 10000;
/** 自带 agent 只认 png / jpeg / webp / gif，单张最好 4MB 以内（Anthropic 单张约 5MB 上限，一条 WebSocket 消息最大 32MB；后端 11-26 说的）。 */
export declare const ASK_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";
export declare const ASK_IMAGE_MAX_BYTES: number;
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