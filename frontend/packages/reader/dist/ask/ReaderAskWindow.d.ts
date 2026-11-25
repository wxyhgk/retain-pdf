/** 阅读页提问的浮动窗口（单独一块，打开时才加载）。
 *
 * - 窗口：react-rnd，标题栏拖动、边角调大小，不出屏幕；Esc / ✕ 关。
 * - 对话：assistant-ui（LocalRuntime + 我们的 ACP 适配，acp-adapter.ts）；回答用 streamdown 渲染（流式 Markdown + KaTeX 公式）。
 * - 思考折叠、工具调用小卡片（要许可时出「允许 / 拒绝」）、计划、子 agent、底下一行用量 / 缓存命中 / 速度 / 用时。
 * 方案：docs/ops/planning/reader-ask/20261125-阅读页提问.md。
 */
import { type ReactElement } from "react";
import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";
export type ReaderAskWindowProps = {
    port: ReaderAskPort;
    jobId: string;
    bookTitle?: string;
    anchor: ReaderAskAnchor;
    onClose: () => void;
    /** 点出处：跳回问的那一处。 */
    onShowAnchor?: () => void;
    /** 这一处上次问过的对话（assistant-ui 导出的），再打开时接着显示；关窗时用 onSave 存回去。 */
    saved?: unknown;
    onSave?: (repository: unknown) => void;
};
export default function ReaderAskWindow({ port, jobId, bookTitle, anchor, onClose, onShowAnchor, saved, onSave }: ReaderAskWindowProps): ReactElement;
//# sourceMappingURL=ReaderAskWindow.d.ts.map