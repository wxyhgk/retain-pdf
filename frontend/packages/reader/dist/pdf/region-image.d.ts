import { type RegionFraction, type RegionPdfDocument } from "./RegionCanvas.js";
/** 截图的宽度（像素）：整页 1600 够看清正文和公式，又远在 4MB 以内。 */
export declare const ASK_IMAGE_WIDTH = 1600;
export declare const FULL_PAGE: RegionFraction;
/** 两个点（屏幕坐标）框出的一块 → 占这一页的比例（夹在页内）；太小（不到页宽高的 2%）是 null。 */
export declare function dragRegion(pageRect: {
    left: number;
    top: number;
    width: number;
    height: number;
}, from: {
    x: number;
    y: number;
}, to: {
    x: number;
    y: number;
}): RegionFraction | null;
/** 用 pdf.js 重新画这一块，宽 width 像素。 */
export declare function renderRegionImage(pdf: RegionPdfDocument, page: number, region?: RegionFraction, width?: number): Promise<Blob>;
/** 从屏幕上已经画好的那张画布裁这一块（没有 pdf.js 文档时用）。 */
export declare function cropCanvasImage(source: HTMLCanvasElement, region?: RegionFraction): Promise<Blob>;
/** 截图的文件名：第 12 页（整页）/ 第 12 页的一块。 */
export declare function regionImageName(page: number, region: RegionFraction): string;
//# sourceMappingURL=region-image.d.ts.map