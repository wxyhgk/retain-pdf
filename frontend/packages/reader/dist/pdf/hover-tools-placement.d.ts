import type { ReaderRegionRect } from "../shared/data/reader-regions.js";
import type { HoverToolsPlacement } from "./ReaderTextHoverLayer.js";
export type HoverToolsLayout = {
    placement: HoverToolsPlacement;
    tailTop?: number;
};
/** 图标按钮的边长；两个按钮排一排多长（中间空 4px）；横排一行的高。 */
export declare const TOOL_SIZE = 24;
export declare const TOOLS_SPAN: number;
export declare const TOOLS_ROW_HEIGHT = 24;
/**
 * 段尾：贴框右边、和最后一行底对齐（再试贴框底）的一行，和框里的字都不碰才算。
 * 缩小看时一行字只有八九像素高，工具条比一行高，只看最后一行右边空不空会压到上面一两行。
 */
export declare function tailToolsTop(frame: ReaderRegionRect, ownGlyphs: readonly ReaderRegionRect[], width: number): number | null;
/** 工具条放哪（做法见文件开头）。`others` 是这一页别的块，`glyphs` 是这一页文字层所有字的位置。 */
export declare function placeHoverTools(input: {
    frame: ReaderRegionRect;
    others: readonly ReaderRegionRect[];
    pageWidth: number;
    pageHeight: number;
    glyphs?: readonly ReaderRegionRect[];
}): HoverToolsLayout;
/**
 * 工具条在框外上方 / 下方时，鼠标斜着走向按钮可能先经过别的块：在工具条那一小块范围里保持当前框。
 * 只管这一小块 —— 以前保持的是框上方整条带，紧贴在上面的短块从下面就再也悬停不到了。
 */
export declare function inHoverToolsZone(presentation: ({
    rect: ReaderRegionRect;
} & HoverToolsLayout) | null, x: number, y: number): boolean;
//# sourceMappingURL=hover-tools-placement.d.ts.map