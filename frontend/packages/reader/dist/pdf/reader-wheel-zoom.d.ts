/** 停手多久算一次缩放结束。 */
export declare const WHEEL_ZOOM_SETTLE_MS = 160;
/** 一个滚轮事件对应的缩放倍数（> 1 放大）。往上滚（deltaY < 0）放大，和浏览器一致。 */
export declare function wheelZoomFactor(deltaY: number, deltaMode?: number): number;
/** 手势累积到的目标缩放（夹在上下限里）。 */
export declare function nextWheelZoom(current: number, deltaY: number, deltaMode?: number): number;
/** 提交的缩放取两位小数，和 +/- 按钮、百分比显示一致。 */
export declare function roundWheelZoom(zoom: number): number;
/**
 * 预览用的 CSS 缩放倍数：新页宽 / 现在的页宽。页宽不和缩放成正比（扣了固定的内边距，见 fitContentWidth），
 * 直接用 target / start 的话，松手那一下会跳几个像素。
 */
export declare function wheelPreviewScale(startZoom: number, targetZoom: number, pageWidth: number): number;
export type ReaderZoomAnchor = {
    page: string;
    pane: string;
    /** 鼠标在这一页里的位置，按页宽、页高的比例。 */
    fracX: number;
    fracY: number;
    clientX: number;
    clientY: number;
    /** 手势开始时这一页的宽（算预览倍数用）。 */
    pageWidth: number;
};
/** 记下鼠标落在哪一页的哪个位置；鼠标在页与页的空隙里时取最近的一页。没有页时返回 null。 */
export declare function captureZoomAnchor(shell: HTMLElement, clientX: number, clientY: number): ReaderZoomAnchor | null;
/** 改完缩放后，把记下的那一点滚回鼠标下面。可以重复调（布局还在变时再对一次），结果不变。 */
export declare function restoreZoomAnchor(shell: HTMLElement, anchor: ReaderZoomAnchor | null): void;
/** 预览：整个页面区按鼠标所在点缩放。 */
export declare function applyWheelPreview(shell: HTMLElement, scale: number, clientX: number, clientY: number): HTMLElement | null;
export declare function clearWheelPreview(grid: HTMLElement | null): void;
//# sourceMappingURL=reader-wheel-zoom.d.ts.map