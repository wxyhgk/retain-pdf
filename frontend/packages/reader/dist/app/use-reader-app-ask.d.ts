import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionHoverStore } from "../shared/state/region-hover-store.js";
export declare function useReaderAppAsk(c: ReaderReactController, { bookmarks, regionHover, readingVersionId }: {
    bookmarks: readonly PdfOutlineNode[];
    regionHover: RegionHoverStore;
    readingVersionId: string | null | undefined;
}): {
    marks: import("../ask/ReaderAskMarks.js").AskMark[];
    onMark: (mark: import("../ask/ReaderAskMarks.js").AskMark) => Promise<void>;
    captureMenu: (target: Element, clientX: number, clientY: number) => void;
    menuActions: {
        key: string;
        label: string;
        hint: string;
        onSelect: () => void;
    }[];
    panel: import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
    open: () => Promise<void>;
};
//# sourceMappingURL=use-reader-app-ask.d.ts.map