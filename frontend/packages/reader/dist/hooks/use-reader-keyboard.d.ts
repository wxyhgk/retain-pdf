import type { ReaderMode } from "./use-reader-session.js";
export type ReaderKeyboardApi = {
    mode: ReaderMode;
    sourceOnly: boolean;
    setMode: (mode: ReaderMode) => void;
    userZoom: number;
    onZoomChange: (zoom: number) => void;
    currentPage: number;
    numPages: number;
    goToPage: (page: number) => void;
    enabled?: boolean;
};
export declare function resolveReaderModeShortcut(key: string, sourceOnly: boolean): ReaderMode | null;
export declare function useReaderKeyboard(api: ReaderKeyboardApi): void;
//# sourceMappingURL=use-reader-keyboard.d.ts.map