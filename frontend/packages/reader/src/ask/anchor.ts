// 问的是哪儿：右键（「在这里提问」「问这段」）或选中后按 ? 那一刻，拼成 ReaderAskAnchor。
// 纯函数（DOM 只读位置），测试在 frontend/web/tests/reader/reader-ask.test.mjs。

import type { ReaderAskAnchor } from "../contracts/ask.js";
import { currentBookmark, flattenOutline, type PdfOutlineNode } from "../pdf/pdf-outline.js";
import { READER_PAGE_ATTR, READER_PANE_ATTR } from "../pdf/reader-dom-contract.js";
import { projectReaderRegion, resolveReaderRegionHighlight, type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
import { selectionCleanText } from "../pdf/page-selection.js";

const SELECTION_LIMIT = 4000;

/** 这一页在哪一节：有书签用书签，没有就用这一页及以前最近的标题块。 */
export function sectionForPage(bookmarks: readonly PdfOutlineNode[], regions: readonly ReaderRegion[], page: number): string {
  if (bookmarks.length) {
    const id = currentBookmark(bookmarks, page);
    const node = id ? flattenOutline(bookmarks).find((entry) => entry.id === id) : null;
    if (node) return node.title;
  }
  let best: ReaderRegion | null = null;
  for (const region of regions) {
    if (!region.headingLevel || region.source.page > page) continue;
    if (!best || region.source.page >= best.source.page) best = region;
  }
  return `${best?.source.text || best?.markdown || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** 选中的字（只认书页文字层里的选区；输入框里的、页外的不算）。 */
export function selectedPageText(selection: Selection | null): { text: string; element: Element | null; rect: DOMRect | null } {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return { text: "", element: null, rect: null };
  const range = selection.getRangeAt(0);
  const start = range.startContainer;
  const element = (start.nodeType === 1 ? (start as Element) : start.parentElement)?.closest?.(`[${READER_PAGE_ATTR}]`) ?? null;
  if (!element) return { text: "", element: null, rect: null };
  // PDF 断行、行尾连字符、数学字母收拾好再带去问；HTML 页照版面画的那层按版面拼（2026-11-28，pdf/page-selection.ts）。
  const text = selectionCleanText(selection).slice(0, SELECTION_LIMIT);
  return { text, element, rect: range.getBoundingClientRect() };
}

/** 离点最近的块：同一页、这一栏的位置；点落在块里距离是 0，不然按上下距离，超过页高的 15% 不算。 */
export function nearestRegion(
  regions: readonly ReaderRegion[],
  metadata: ReaderMetadata | null,
  pane: "source" | "translated",
  page: number,
  point: { x: number; y: number },
): ReaderRegion | null {
  let best: ReaderRegion | null = null;
  let bestDistance = 0.15;
  for (const region of regions) {
    const highlight = resolveReaderRegionHighlight(region, metadata, pane);
    if (!highlight || highlight.box.page !== page) continue;
    const rect = projectReaderRegion(highlight, 1, 1);
    if (!rect) continue;
    const dy = point.y < rect.top ? rect.top - point.y : point.y > rect.top + rect.height ? point.y - rect.top - rect.height : 0;
    const dx = point.x < rect.left ? rect.left - point.x : point.x > rect.left + rect.width ? point.x - rect.left - rect.width : 0;
    const distance = dy + dx * 0.25;
    if (distance < bestDistance || (distance === 0 && best === null)) {
      best = region;
      bestDistance = distance;
    }
  }
  return best;
}

export function buildAskAnchor({
  pageElement,
  clientX,
  clientY,
  itemId,
  selection,
  regions,
  bookmarks,
  metadata = null,
}: {
  /** 点到的那一页（[data-reader-page]）。 */
  pageElement: Element | null;
  clientX: number;
  clientY: number;
  /** 悬停框认出的块（没有就 null）。 */
  itemId: string | null;
  selection: string;
  regions: readonly ReaderRegion[];
  bookmarks: readonly PdfOutlineNode[];
  /** 页面尺寸（悬停还没认出块时，按位置找最近的块要用）。 */
  metadata?: ReaderMetadata | null;
}): ReaderAskAnchor | null {
  if (!pageElement) return null;
  const page = Number(pageElement.getAttribute(READER_PAGE_ATTR)) || 0;
  if (page < 1) return null;
  const pane = pageElement.getAttribute(READER_PANE_ATTR) === "source" ? "source" : "translated";
  const rect = pageElement.getBoundingClientRect();
  const point = rect.width > 0 && rect.height > 0
    ? { x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)) }
    : null;
  // 悬停框认出的块优先；没认出（鼠标刚移过来、点在两段之间）就按位置找最近的那块，免得问题里一个字都没带。
  const hovered = itemId ? regions.find((entry) => entry.itemId === itemId) ?? null : null;
  const region = hovered ?? (point ? nearestRegion(regions, metadata, pane, page, point) : null);
  return {
    pane,
    page,
    itemId: region?.itemId ?? null,
    selection,
    sourceText: `${region?.source.text || region?.markdown || ""}`.trim(),
    translatedText: `${region?.translatedBlockText || region?.translated.text || ""}`.trim(),
    section: sectionForPage(bookmarks, regions, region?.source.page ?? page),
    point,
  };
}
