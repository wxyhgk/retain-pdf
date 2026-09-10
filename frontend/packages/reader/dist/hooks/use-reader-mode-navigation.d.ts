import type { ReaderMode } from "./use-reader-session.js";
export type ModeNavigationApi = {
    setModeKeepingPage: (next: ReaderMode) => void;
};
/**
 * Mode switch that freezes/restores reading anchor via beginModeSwitch.
 * Keeps a stable callback by reading latest mode/setMode/beginModeSwitch from refs.
 */
export declare function useReaderModeNavigation(options: {
    mode: ReaderMode;
    setMode: (mode: ReaderMode) => void;
    beginModeSwitch: () => void;
}): ModeNavigationApi;
//# sourceMappingURL=use-reader-mode-navigation.d.ts.map