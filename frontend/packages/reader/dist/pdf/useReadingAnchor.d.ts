import type { RefObject } from "react";
import { type PageScrollProgress } from "./scroll-to-page.js";
export type ReadingAnchorPane = "source" | "translated";
export declare function useReadingAnchor(shellRef: RefObject<HTMLElement | null>, options: {
    primaryPane: ReadingAnchorPane;
    /** when mode changes, hook restores locked progress */
    mode: string;
    /** false while boot loading */
    enabled?: boolean;
    /** job/document scoped key used to restore after refresh */
    persistenceKey?: string;
    /** true after the primary PDF has page nodes to restore against */
    restoreReady?: boolean;
}): {
    /** measure shell progress (HUD / fallback); does not freeze restore */
    lockFromShell: () => PageScrollProgress;
    /** call before setMode; freezes restore and locks progress */
    beginModeSwitch: () => PageScrollProgress;
    /** jump to page top; freezes briefly */
    goToPage: (page: number, numPages: number, pane?: ReadingAnchorPane) => void;
    getAnchor: () => PageScrollProgress;
    isRestoring: () => boolean;
    /** call when layout settles (rowHeights/shellWidth) while restoring — re-pin locked only */
    repinIfRestoring: () => void;
};
//# sourceMappingURL=useReadingAnchor.d.ts.map