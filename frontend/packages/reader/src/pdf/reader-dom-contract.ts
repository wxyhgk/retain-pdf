/** Shared DOM contract for the React PDF reader (selectors / attrs / class names). */

export const READER_PAGE_ATTR = "data-reader-page";
export const READER_PANE_ATTR = "data-reader-pane";
export const READER_SCROLL_SHELL_ID = "reader-scroll-shell";
export const READER_SCROLL_SHELL_CLASS = "reader-react-scroll-shell";
export const READER_PAGE_SLOT_CLASS = "reader-react-pdf-page-slot";

export type ReaderPaneId = "source" | "translated";

export function pageSelector(page?: number, pane?: ReaderPaneId | null): string {
  const pagePart = page != null
    ? `[${READER_PAGE_ATTR}="${page}"]`
    : `[${READER_PAGE_ATTR}]`;
  if (pane) {
    return `${pagePart}[${READER_PANE_ATTR}="${pane}"]`;
  }
  return pagePart;
}

export function pageInPaneSelector(pane: ReaderPaneId): string {
  return `[${READER_PAGE_ATTR}][${READER_PANE_ATTR}="${pane}"]`;
}

export function pageSlotSelector(): string {
  return `.${READER_PAGE_SLOT_CLASS}[${READER_PAGE_ATTR}]`;
}

export function getPageAttr(el: Element): number {
  return Number(el.getAttribute(READER_PAGE_ATTR));
}
