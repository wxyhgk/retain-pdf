import type { RefObject } from "react";
export type ReaderZoomChangeOptions = {
    /** 默认 true：按比例把视口中心钉住。滚轮缩放自己按鼠标位置对齐，传 false。 */
    keepScroll?: boolean;
};
export type ReaderZoomChange = (zoom: number, options?: ReaderZoomChangeOptions) => void;
export type ReaderZoomApi = {
    userZoom: number;
    onZoomChange: ReaderZoomChange;
    stepZoom: (direction: 1 | -1) => void;
    resetZoom: (mode?: string) => void;
};
export declare function useReaderZoom(initialMode?: string, shellRef?: RefObject<HTMLElement | null>, persistenceKey?: string): ReaderZoomApi;
//# sourceMappingURL=use-reader-zoom.d.ts.map