import type { ReaderAssistantPanel } from "../components/react-pdf/index.js";
import type { ReaderApi } from "../extensions/types.js";
import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import type { ReaderTranslationVersions } from "../hooks/use-reader-version-compare.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionHoverStore } from "../shared/state/region-hover-store.js";
/** 扩展登记的那张表，以及阅读页排版要先知道的一项（扩展的浮层贴右边让出多宽）。
 * 单独一个 hook：书页区的宽度、对照放不放得下要在排台面之前算，而给扩展看的接口（下面）要用排好的台面。 */
export declare function useReaderContributionTable(): {
    contributionStore: import("../extensions/registry.js").ReaderContributionStore;
    contributions: import("../extensions/registry.js").ReaderContributions;
    reserveRight: number;
};
export type ReaderContributionTable = ReturnType<typeof useReaderContributionTable>;
/** 右边只停一个：扩展的浮层刚贴到右边时，关掉停着的面板（Markdown）；面板刚打开时，扩展从 activePanel 看到、自己挪开
 * （提问窗变回浮动，见 use-reader-ask 的 dockTaken）。两头都只看「刚变」的那一下，后来的那个留下。 */
export declare function useRightDockSlot(reserveRight: number, assistantPanel: unknown, closeAssistant: () => void): void;
export declare function useReaderExtensionHost(c: ReaderReactController, table: ReaderContributionTable, { translationVersions, bookmarks, regionHover, assistantPanel, closeAssistant, visiblePdfMode, changeWorkspace, jumpToBlockIn, zoomDocuments, editBlock, panelHost, }: {
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
    panelHost?: HTMLElement | null;
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