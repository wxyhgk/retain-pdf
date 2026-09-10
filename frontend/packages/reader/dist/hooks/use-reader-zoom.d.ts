import type { RefObject } from "react";
export type ReaderZoomApi = {
    userZoom: number;
    onZoomChange: (zoom: number) => void;
    stepZoom: (direction: 1 | -1) => void;
    resetZoom: (mode?: string) => void;
};
export declare function useReaderZoom(initialMode?: string, shellRef?: RefObject<HTMLElement | null>, persistenceKey?: string): ReaderZoomApi;
//# sourceMappingURL=use-reader-zoom.d.ts.map