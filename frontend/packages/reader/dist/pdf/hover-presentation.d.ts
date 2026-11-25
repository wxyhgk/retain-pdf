import { type RefObject } from "react";
import { type ReaderRegionRect } from "../shared/data/reader-regions.js";
import type { ReaderTextHoverTarget } from "./ReaderTextHoverLayer.js";
import { type HoverToolsLayout } from "./hover-tools-placement.js";
export { inHoverToolsZone, placeHoverTools, tailToolsTop, type HoverToolsLayout } from "./hover-tools-placement.js";
/**
 * 框收到字的范围：中心落在原块里的字取并集，四边各留 pad。没有字就照原块。
 * 最多比原块往外多出 slack：排版有时把首行画得比原块上沿还高一点，框不能压在字上。
 */
export declare function tightenHoverRect(rect: ReaderRegionRect, glyphs: readonly ReaderRegionRect[], pad?: number, slack?: number): ReaderRegionRect;
export type HoverPresentation = ({
    rect: ReaderRegionRect;
} & HoverToolsLayout) | null;
/** 悬停块的框和工具条位置。画面绘制前量好（layout effect），框不会先画大再缩。 */
export declare function useHoverPresentation(hostRef: RefObject<HTMLElement | null>, target: ReaderTextHoverTarget | null, targets: readonly ReaderTextHoverTarget[], pageWidth: number): HoverPresentation;
//# sourceMappingURL=hover-presentation.d.ts.map