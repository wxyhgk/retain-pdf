import { type ReaderRegionHighlight, type ReaderRegionRect } from "../shared/data/reader-regions.js";
export type ReaderTextHoverTarget = {
    itemId: string;
    highlight: ReaderRegionHighlight;
    rect: ReaderRegionRect;
};
export declare function projectReaderTextHoverTargets(regions: readonly ReaderRegionHighlight[], width: number, height: number): ReaderTextHoverTarget[];
export declare function hitTestReaderTextHoverTarget(targets: readonly ReaderTextHoverTarget[], x: number, y: number): ReaderTextHoverTarget | null;
/**
 * 写剪贴板。`navigator.clipboard` 在非安全上下文（局域网 IP 打开的 http 页面）里不存在，
 * 退回 execCommand("copy")；两条都失败返回 false，不假装成功。
 */
export declare function copyReaderText(text: string): Promise<boolean>;
export declare const READER_TEXT_HOVER_COPY_CLASS = "reader-text-hover-copy";
export declare const READER_TEXT_HOVER_EDIT_CLASS = "reader-text-hover-edit";
export declare const READER_TEXT_HOVER_ID_CLASS = "reader-text-hover-id";
/**
 * 框上要不要显示翻译编号（和翻译调试、日志里的 item_id 同一个）：读者用不上，默认不显示；排查翻译问题时在阅读页地址后
 * 加 `?debug=1`（或 `&debug=1`）就出来，点一下复制。2026-11-12 以前每个读者都看得到。
 */
export declare function readerShowsItemIds(search?: string): boolean;
export declare const READER_TEXT_HOVER_TOOLS_CLASS = "reader-text-hover-tools";
/** 工具条放哪：框外右边 / 左边的页边（竖排，见 hover-presentation 的 hoverToolsPlacement），框里右上角，框外上方。 */
export type HoverToolsPlacement = "side-right" | "side-left" | "inside" | "outside";
/** 工具条（编号 + 复制）大约占的尺寸：放进框内放不下时才挪到框外上方。 */
export declare const HOVER_TOOLS_HEIGHT = 26;
export declare const HOVER_TOOLS_WIDTH = 220;
/**
 * 工具条放哪：一般的块放在框内右上角 —— 它就在块的命中范围里，鼠标走过去不会换块，
 * 也不盖住上一块。框太矮或太窄（行间公式常常只有一行高）放不下时才挪到框外上方。
 */
export declare function hoverToolsOutside(rect: ReaderRegionRect, toolsWidth?: number): boolean;
/**
 * 悬停内容块：淡色的框 + 翻译编号 + 「复制」（行间公式是「复制 LaTeX」）。
 * 框和工具条位置由页面量好传进来（frameRect 贴着字、placement 放页边，见 hover-presentation）；不传就照原块、按旧规则放。
 * 2026-11-20 以前是红色虚线框、工具条压在框里第一行字上。
 *
 * 对照阅读时左右两栏一起画（悬停的 itemId 由 ReaderCompareGrid 共享），左栏复制原文、
 * 右栏复制译文 —— 这是 4.1.x 旧引擎里最常用的那个交互，React 引擎替换时丢了。
 * 只有这一种块级交互：双击 / 三击留给浏览器选词选段（以前双击会整块复制，把选词弄坏了）。
 */
export declare function ReaderTextHoverLayer({ target, pane, revisedCount, onEdit, frameRect, placement, }: {
    target: ReaderTextHoverTarget | null;
    /** 框画多大：贴着字的范围（不给就是原块）。 */
    frameRect?: ReaderRegionRect | null;
    /** 工具条放哪（不给按框的大小选框里 / 框外上方）。 */
    placement?: HoverToolsPlacement;
    pane?: "source" | "translated";
    /** 这一块改过几次（精修、手改、助手改）；只在译文栏提示。 */
    revisedCount?: number;
    /** 译文栏的「改」：打开侧栏「改译文」改这一块。不给就不画。 */
    onEdit?: (itemId: string) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=ReaderTextHoverLayer.d.ts.map