import { type ReaderRegionHighlight, type ReaderRegionSelection } from "../shared/data/reader-regions.js";
import type { ReaderPaneId } from "./reader-dom-contract.js";
export type ReaderStructureSelectionLayerProps = {
    pane: ReaderPaneId;
    width: number;
    height: number;
    regions: ReaderRegionHighlight[];
    onSelect?: (selection: ReaderRegionSelection) => void;
};
/**
 * 独立于 PDF canvas / textLayer 的 OCR 结构选择层。
 * 容器本身不拦截事件，仅公式、表格和图片的命中框可交互，正文仍走
 * pdf.js 原生文字选择。
 */
export declare function ReaderStructureSelectionLayer({ pane, width, height, regions, onSelect, }: ReaderStructureSelectionLayerProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderStructureSelectionLayer.d.ts.map