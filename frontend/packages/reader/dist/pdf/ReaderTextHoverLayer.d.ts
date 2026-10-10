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
export declare const READER_TEXT_HOVER_ID_CLASS = "reader-text-hover-id";
export declare const READER_TEXT_HOVER_TOOLS_CLASS = "reader-text-hover-tools";
/** 工具条（编号 + 复制）大约占的尺寸：放进框内放不下时才挪到框外上方。 */
export declare const HOVER_TOOLS_HEIGHT = 26;
export declare const HOVER_TOOLS_WIDTH = 190;
/**
 * 工具条放哪：一般的块放在框内右上角 —— 它就在块的命中范围里，鼠标走过去不会换块，
 * 也不盖住上一块。框太矮或太窄（行间公式常常只有一行高）放不下时才挪到框外上方。
 */
export declare function hoverToolsOutside(rect: ReaderRegionRect): boolean;
/**
 * 悬停内容块：红色虚线框 + 翻译编号 + 「复制」（行间公式是「复制 LaTeX」）。
 *
 * 对照阅读时左右两栏一起画（悬停的 itemId 由 ReaderCompareGrid 共享），左栏复制原文、
 * 右栏复制译文 —— 这是 4.1.x 旧引擎里最常用的那个交互，React 引擎替换时丢了。
 * 只有这一种块级交互：双击 / 三击留给浏览器选词选段（以前双击会整块复制，把选词弄坏了）。
 */
export declare function ReaderTextHoverLayer({ target, pane, revisedCount, }: {
    target: ReaderTextHoverTarget | null;
    pane?: "source" | "translated";
    /** 这一块改过几次（精修、手改、助手改）；只在译文栏提示。 */
    revisedCount?: number;
}): import("react").JSX.Element;
//# sourceMappingURL=ReaderTextHoverLayer.d.ts.map