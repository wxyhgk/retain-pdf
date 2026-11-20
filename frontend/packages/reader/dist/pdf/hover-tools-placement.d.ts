import type { ReaderRegionRect } from "../shared/data/reader-regions.js";
import type { HoverToolsPlacement } from "./ReaderTextHoverLayer.js";
export type HoverToolsLayout = {
    placement: HoverToolsPlacement;
    compact: boolean;
    tailTop?: number;
};
/** 竖着排的完整按钮要多宽：「改」「复制」放得下；行间公式的「复制 LaTeX」宽一些。 */
export declare function sideToolsWidth(kind: string): number;
/** 图标小按钮的边长；横排一行的高；一行多宽（「改」+「复制」，公式是「复制 LaTeX」）。 */
export declare const COMPACT_TOOL_SIZE = 24;
export declare const TOOLS_ROW_HEIGHT = 24;
export declare function rowToolsWidth(kind: string, compact: boolean): number;
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
    kind?: string;
}): HoverToolsLayout;
/**
 * 工具条在框外上方 / 下方时，鼠标斜着走向按钮可能先经过别的块：在工具条那一小块范围里保持当前框。
 * 只管这一小块 —— 以前保持的是框上方整条带，紧贴在上面的短块从下面就再也悬停不到了。
 */
export declare function inHoverToolsZone(presentation: ({
    rect: ReaderRegionRect;
} & HoverToolsLayout) | null, kind: string, x: number, y: number): boolean;
//# sourceMappingURL=hover-tools-placement.d.ts.map