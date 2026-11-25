/** 放大查看一块（图、表、公式、一段文字）：盖在书上的大框，这一块按高分辨率重新画（RegionCanvas），放多大都清楚。
 *
 * - 打开：悬停框工具条上的「放大」；图片也可以双击（文字块的双击留给浏览器选词）。
 * - 对照时原文、译文那一块左右并排（两份 PDF 都有、这一块两边都有位置时）。
 * - 框里：⌘/Ctrl + 滚轮、+ / − 放大缩小，拖着或滚动看；← → 换到书里上一块 / 下一块同类的（图翻图，字翻字）；Esc 关。
 */
import { type ReactElement } from "react";
import { type ReaderMetadata, type ReaderRegion } from "../../shared/data/reader-regions.js";
import { type RegionFraction, type RegionPdfDocument } from "../../pdf/RegionCanvas.js";
export type ZoomPane = "source" | "translated";
export type ReaderZoomDocuments = Partial<Record<ZoomPane, RegionPdfDocument | null>>;
/** 一块在某一栏里画哪一页的哪一块（比例）；这一栏没有位置或没有页面尺寸时为 null。 */
export declare function zoomRegionIn(region: ReaderRegion, metadata: ReaderMetadata | null, pane: ZoomPane): ZoomPlace | null;
type ZoomPlace = {
    page: number;
    fraction: RegionFraction; /** 高 / 宽 */
    aspect: number;
};
/** 几块合起来画（引用预览：图注 + 图 / 表）：取第一块所在页上各块的并集，别的页的块不算。 */
export declare function zoomUnionIn(regions: readonly ReaderRegion[], metadata: ReaderMetadata | null, pane: ZoomPane): ZoomPlace | null;
/** 100% 时一栏画多宽：先占满栏宽，太高（高的图、整页的表）就按放得下的高度缩，打开不用先滚。 */
export declare function zoomFitWidth(columnWidth: number, availableHeight: number, aspects: readonly number[]): number;
/** 书里同一类的块（图和表算一类「图表」，公式一类，文字一类），按阅读顺序。← → 在里面走。 */
export declare function zoomSiblings(regions: readonly ReaderRegion[], current: ReaderRegion): ReaderRegion[];
export declare function ReaderZoomViewer({ itemId, regions, metadata, documents, panes, onNavigate, onClose, }: {
    itemId: string;
    regions: readonly ReaderRegion[];
    metadata: ReaderMetadata | null;
    documents: ReaderZoomDocuments;
    /** 画哪几栏（对照时两栏，否则当前那一栏）。 */
    panes: readonly ZoomPane[];
    onNavigate: (itemId: string) => void;
    onClose: () => void;
}): ReactElement | null;
export {};
//# sourceMappingURL=ReaderZoomViewer.d.ts.map