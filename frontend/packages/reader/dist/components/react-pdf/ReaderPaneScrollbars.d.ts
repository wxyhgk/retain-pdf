export type PaneScrollMetrics = {
    pane: string;
    /** 这一栏相对阅读区左边的位置和宽度（滚动条画在它下面）。 */
    left: number;
    width: number;
    scrollWidth: number;
    scrollLeft: number;
};
/** 滑块的宽度和位置（像素，相对轨道左边）；放得下时返回 null。 */
export declare function paneScrollThumb(metrics: Pick<PaneScrollMetrics, "width" | "scrollWidth" | "scrollLeft">, trackWidth: number, minThumb?: number): {
    size: number;
    offset: number;
} | null;
/** 滑块挪了 dx 像素，栏要滚多少。 */
export declare function paneScrollDelta(metrics: Pick<PaneScrollMetrics, "width" | "scrollWidth">, trackWidth: number, thumbSize: number, dx: number): number;
export declare function ReaderPaneScrollbars({ shellEl }: {
    shellEl: HTMLElement | null;
}): import("react").JSX.Element;
//# sourceMappingURL=ReaderPaneScrollbars.d.ts.map