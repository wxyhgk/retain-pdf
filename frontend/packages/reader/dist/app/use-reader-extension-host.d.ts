import type { ReaderAssistantPanel } from "../components/react-pdf/index.js";
import type { ReaderApi } from "../extensions/types.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderTranslationVersions } from "../hooks/use-reader-version-compare.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionHoverStore } from "../shared/state/region-hover-store.js";
export declare function useReaderExtensionHost(c: ReaderReactController, { translationVersions, bookmarks, regionHover, assistantPanel, closeAssistant, visiblePdfMode, changeWorkspace, jumpToBlockIn, zoomDocuments, editBlock, }: {
    translationVersions: ReaderTranslationVersions;
    bookmarks: readonly PdfOutlineNode[];
    regionHover: RegionHoverStore;
    assistantPanel: ReaderAssistantPanel | null;
    closeAssistant: () => void;
    visiblePdfMode: ReaderApi["visibleMode"];
    changeWorkspace: ReaderApi["setWorkspace"];
    jumpToBlockIn: ReaderApi["jumpToBlock"];
    zoomDocuments: ReaderApi["pdfDocuments"];
    editBlock: ReaderApi["editBlock"];
}): {
    readerApi: ReaderApi;
    contributionStore: import("../extensions/registry.js").ReaderContributionStore;
    contributions: import("../extensions/registry.js").ReaderContributions;
    pageLayers: import("../extensions/registry.js").ReaderPageLayer[];
    compareVersion: import("../extensions/types.js").ReaderComparedDocument;
    textMarks: (text: string) => import("../shared/content/reader-text-marks.js").ReaderTextMark[];
    menuSections: import("../extensions/registry.js").ReaderMenuSection[];
    pointerTakenId: string;
    reserveRight: number;
};
//# sourceMappingURL=use-reader-extension-host.d.ts.map