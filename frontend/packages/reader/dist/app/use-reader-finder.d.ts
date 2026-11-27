import type { ReaderFinderTab } from "../components/react-pdf/ReaderFinder.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
/** 窄于这个宽度钉住也当浮着。 */
export declare const SIDEBAR_PIN_MIN_VIEWPORT = 900;
type SidebarMemory = {
    pinned: boolean;
    open: boolean;
    tab: ReaderFinderTab;
};
export declare function loadSidebarMemory(): SidebarMemory;
export declare function useReaderFinder(c: ReaderReactController): {
    finder: ReaderFinderTab;
    setFinder: (tab: ReaderFinderTab | null) => void;
    toggleFinder: (tab: ReaderFinderTab) => void;
    toggleSidebar: () => void;
    pinned: boolean;
    pinnedChoice: boolean;
    setPinned: (next: boolean) => void;
    canPin: boolean;
    findQuery: string;
    setFindQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
    findTerm: string;
    findFocus: number;
    jumpFromFinder: (itemId: string) => void;
    jumpToPageFromFinder: (page: number) => void;
};
export type ReaderFinderState = ReturnType<typeof useReaderFinder>;
export {};
//# sourceMappingURL=use-reader-finder.d.ts.map