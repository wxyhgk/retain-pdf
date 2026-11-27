import type { ReaderFinderTab } from "../components/react-pdf/ReaderFinder.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
export declare function useReaderFinder(c: ReaderReactController): {
    finder: ReaderFinderTab;
    setFinder: import("react").Dispatch<import("react").SetStateAction<ReaderFinderTab>>;
    toggleFinder: (tab: ReaderFinderTab) => void;
    findQuery: string;
    setFindQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
    findTerm: string;
    findFocus: number;
    jumpFromFinder: (itemId: string) => void;
    jumpToPageFromFinder: (page: number) => void;
};
export type ReaderFinderState = ReturnType<typeof useReaderFinder>;
//# sourceMappingURL=use-reader-finder.d.ts.map