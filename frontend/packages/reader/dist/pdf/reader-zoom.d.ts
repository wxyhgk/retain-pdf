export declare const READER_ZOOM_MIN = 0.25;
export declare const READER_ZOOM_MAX = 1;
export declare const READER_ZOOM_STEP = 0.05;
/** 默认 50%：半屏宽，对照两侧刚好铺满 */
export declare const READER_ZOOM_DEFAULT = 0.5;
/** @deprecated */
export declare const READER_ZOOM_SINGLE_DEFAULT = 0.5;
export declare const READER_ZOOM_COMPARE_DEFAULT = 0.5;
/** 栏内左右 padding 合计 */
export declare const READER_PANE_PAD_X = 16;
export declare const READER_PANE_FIT_GUTTER = 8;
export type ReaderZoomMode = "source" | "translated" | "compare";
export declare function defaultZoomForMode(_mode?: ReaderZoomMode | string): number;
/** 内部 zoom 即「占 shell 全宽的比例」0.25–1 */
export declare function clampReaderZoom(value: number): number;
export declare function stepReaderZoom(current: number, direction: 1 | -1): number;
/** UI 显示百分比 = zoom × 100（最大 100） */
export declare function zoomToDisplayPercent(zoom: number): number;
/** UI 百分比 → zoom */
export declare function displayPercentToZoom(percent: number): number;
/** 对照半栏宽（仅布局用，不参与 zoom 百分比语义） */
export declare function comparePaneWidth(shellWidth: number): number;
/**
 * 目标容器可用内容宽（扣 padding）。
 * 这里的 containerWidth 应是「期望页宽对应的壳宽度」= shellWidth × zoom。
 */
export declare function fitContentWidth(containerWidth: number): number;
/**
 * 由 shell 全宽 + 全宽占比 zoom 得到绘制页宽。
 * 原文/译文/对照共用：同一 zoom → 同一页像素宽。
 */
export declare function pageWidthFromShell(shellWidth: number, userZoom?: number): number;
/**
 * @deprecated 易误解为「按栏宽缩放」。请用 pageWidthFromShell(shellWidth, zoom)。
 * 保留签名以免旧调用崩：把 first arg 当作 shell 半宽时行为与旧半栏 unit 不同。
 */
export declare function pageWidthForPane(shellOrPaneWidth: number, userZoom?: number): number;
export declare function preserveScrollCenter(shell: HTMLElement | null | undefined, zoomRatio: number): void;
//# sourceMappingURL=reader-zoom.d.ts.map