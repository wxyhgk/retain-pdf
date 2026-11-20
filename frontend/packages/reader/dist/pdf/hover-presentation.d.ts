import { type RefObject } from "react";
import type { ReaderRegionRect } from "../shared/data/reader-regions.js";
import { type HoverToolsPlacement, type ReaderTextHoverTarget } from "./ReaderTextHoverLayer.js";
/** 竖着排的工具条要多宽：「改」「复制」放得下；行间公式的「复制 LaTeX」宽一些。 */
export declare function sideToolsWidth(kind: string): number;
/**
 * 工具条放哪。右边空：到页右边、或到右边第一个和它上下有重叠的块，空出 toolsWidth + 间距；左边同理。
 * `others` 是这一页别的块（含它自己也行，自己会被跳过）。
 */
export declare function hoverToolsPlacement(rect: ReaderRegionRect, others: readonly ReaderRegionRect[], pageWidth: number, toolsWidth: number): HoverToolsPlacement;
/**
 * 框收到字的范围：中心落在原块里的字取并集，四边各留 pad。没有字就照原块。
 * 最多比原块往外多出 slack：排版有时把首行画得比原块上沿还高一点，框不能压在字上。
 */
export declare function tightenHoverRect(rect: ReaderRegionRect, glyphs: readonly ReaderRegionRect[], pad?: number, slack?: number): ReaderRegionRect;
export type HoverPresentation = {
    rect: ReaderRegionRect;
    placement: HoverToolsPlacement;
} | null;
/** 悬停块的框和工具条位置。画面绘制前量好（layout effect），框不会先画大再缩。 */
export declare function useHoverPresentation(hostRef: RefObject<HTMLElement | null>, target: ReaderTextHoverTarget | null, targets: readonly ReaderTextHoverTarget[], pageWidth: number, kind: string): HoverPresentation;
//# sourceMappingURL=hover-presentation.d.ts.map