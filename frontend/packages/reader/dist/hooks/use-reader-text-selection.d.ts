import type { RefObject } from "react";
import type { ReaderTextSelection } from "../shared/data/reader-regions.js";
export type { ReaderTextSelection } from "../shared/data/reader-regions.js";
export declare function useReaderTextSelection(rootRef: RefObject<HTMLElement | null>, enabled?: boolean): {
    selection: ReaderTextSelection | null;
    clearSelection: () => void;
};
//# sourceMappingURL=use-reader-text-selection.d.ts.map