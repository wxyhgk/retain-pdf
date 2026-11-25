/** pdf.js PDFDocumentProxy / PDFPageProxy 里用到的那几样。 */
export type RegionPdfDocument = {
    getPage(pageNumber: number): Promise<RegionPdfPage>;
};
type RegionViewport = {
    width: number;
    height: number;
};
export type RegionPdfPage = {
    getViewport(options: {
        scale: number;
        offsetX?: number;
        offsetY?: number;
    }): RegionViewport;
    render(options: {
        canvasContext: CanvasRenderingContext2D;
        viewport: RegionViewport;
    }): {
        promise: Promise<void>;
        cancel(): void;
    };
};
/** 区域：占整页的比例，左上角为原点。 */
export type RegionFraction = {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** 画布最大边长（像素）：再大浏览器可能画不出来，也太占内存。 */
export declare const REGION_CANVAS_MAX_PX = 6000;
/** 四周留一点边，框住的字不贴边。 */
export declare function padRegion(region: RegionFraction, pad?: number): RegionFraction;
/**
 * 画这一块要用的缩放和画布尺寸：画布宽 = 显示宽 × 像素比，超过上限按比例缩。
 * pageSize 是缩放 1 时整页的大小（PDF 点）。
 */
export declare function regionRenderPlan(region: RegionFraction, pageSize: {
    width: number;
    height: number;
}, cssWidth: number, pixelRatio: number): {
    scale: number;
    offsetX: number;
    offsetY: number;
    canvasWidth: number;
    canvasHeight: number;
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: number;
};
export declare function RegionCanvas({ pdf, page, region, cssWidth, className, label, }: {
    pdf: RegionPdfDocument;
    page: number;
    region: RegionFraction;
    /** 显示宽度（CSS 像素）。 */
    cssWidth: number;
    className?: string;
    label?: string;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=RegionCanvas.d.ts.map