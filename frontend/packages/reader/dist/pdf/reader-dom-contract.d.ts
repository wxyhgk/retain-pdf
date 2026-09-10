/** Shared DOM contract for the React PDF reader (selectors / attrs / class names). */
export declare const READER_PAGE_ATTR = "data-reader-page";
export declare const READER_PANE_ATTR = "data-reader-pane";
export declare const READER_SCROLL_SHELL_ID = "reader-scroll-shell";
export declare const READER_SCROLL_SHELL_CLASS = "reader-react-scroll-shell";
export declare const READER_PAGE_SLOT_CLASS = "reader-react-pdf-page-slot";
export type ReaderPaneId = "source" | "translated";
export declare function pageSelector(page?: number, pane?: ReaderPaneId | null): string;
export declare function pageInPaneSelector(pane: ReaderPaneId): string;
export declare function pageSlotSelector(): string;
export declare function getPageAttr(el: Element): number;
//# sourceMappingURL=reader-dom-contract.d.ts.map