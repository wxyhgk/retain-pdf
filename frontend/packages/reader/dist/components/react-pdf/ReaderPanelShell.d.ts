/** dock 面板的通用外壳：贴住右侧工作区、Esc 关闭、关掉就卸载。
 *
 * 以前还有 keepMounted（关掉时藏而不卸载），只给终端、画布用；它们 2026-11-03 随 RetainPDF 自己的 AI 删了，
 * 2026-11-12 连同 react-pdf.css 里那条 [data-hidden] 规则一起删掉。
 *
 * ## 这里原来还有「浮窗」形态，删掉了
 *
 * 原来叫 ReaderFloatShell，支持 floating / dock-right / workspace 三种
 * placement。实际情况是：
 *
 * - `dock-right` **零调用点**，却带着 86 行 CSS；
 * - `floating` 的拖动是**坏的** —— clampPos 用
 *   `approxH = min(innerHeight*0.9, 860)` 估高度，而真实高度是
 *   `max-height: min(72dvh, 560px)`。1280×800 下垂直行程只剩 56px（12–68），
 *   本该有 216px，往下拖会弹回顶部；
 * - 三个浮窗的 defaultPos 完全相同 `(innerWidth - 380, 72)`，z 都是 48，
 *   同时打开必然精确重叠，谁在上只看 DOM 顺序；
 * - 8 个 storageKey 有 5 个是死的：anchored 时 onPointerDown 第一行就 return，
 *   位置永远写不进 localStorage。
 *
 * 所以删掉的不是一个能用的交互，是一个一直没人验过的交互。现在所有面板都在
 * dock 里，位置由 CSS 一处决定。
 *
 * ## 为什么连面板自己的标题栏也没了
 *
 * 面板一次只开一个，dock 顶上的 tab 条已经写着你在哪个面板、并且带关闭按钮。
 * 再画一条标题栏等于同一件事说两遍，还白占 40px 高 —— Markdown / AI 早就是
 * `showHeader={false}`，只有批注那三个还在画，纯粹因为它们不在 dock 里。
 *
 * ## 为什么还留着 reader-notes-panel 这个类名
 *
 * 它是这套面板皮肤（工具条、正文滚动区）的命名空间，被 float-ai /
 * float-markdown / notes-float 三份分片共用。改名要同步动 4 个 CSS 文件，
 * 没有任何行为收益，留给单独一轮。
 */
import { type ReactNode } from "react";
export type ReaderPanelShellProps = {
    id: string;
    open: boolean;
    ariaLabel: string;
    className?: string;
    onClose: () => void;
    toolbar?: ReactNode;
    children: ReactNode;
};
export declare function ReaderPanelShell({ id, open, ariaLabel, className, onClose, toolbar, children, }: ReaderPanelShellProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderPanelShell.d.ts.map