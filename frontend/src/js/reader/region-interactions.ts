import {
  clearRegionLayers,
  ensureRegionLayer,
  getPageCanvasBoxWithPdfSize,
  pageNumberOfElement,
  placeRegionBox,
  regionRectFromBox,
} from "./page-geometry.js";
import {
  copyTextToClipboard,
  normalizeReaderRegions,
} from "./region-utils.js";
import {
  formatReaderRegionMarkdownPayload,
  renderReaderMarkdownPayload,
  renderReaderMarkdownPopover,
} from "./region-popover.js";
import type { PageAnchor, PixelRect, SelectionQuote } from "./types.js";

let regionOverlayTicking = false;
let readerRegionBinding = null;
let selectedReaderRegion = null;
let hoveredReaderRegion = null;
const readerRegionItemCache = new Map();

function findTranslatedRegionAtPoint(event) {
  const binding = readerRegionBinding;
  if (!binding?.translatedController || !binding.regions.length) {
    return null;
  }
  const pageElement = event.target?.closest?.(".page[data-page-number]");
  if (!pageElement || !binding.translatedController.viewerElement.contains(pageElement)) {
    return null;
  }
  const pageNumber = pageNumberOfElement(pageElement);
  if (!pageNumber) {
    return null;
  }
  const pageRect = pageElement.getBoundingClientRect();
  const x = event.clientX - pageRect.left;
  const y = event.clientY - pageRect.top;
  const canvasBox = getPageCanvasBoxWithPdfSize(binding.translatedController, pageElement, pageNumber);
  if (!canvasBox) {
    return null;
  }
  for (let index = binding.regions.length - 1; index >= 0; index -= 1) {
    const region = binding.regions[index];
    if (region.translated.page !== pageNumber) {
      continue;
    }
    const rect = regionRectFromBox(region.translated.bbox, canvasBox);
    if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return region;
    }
  }
  return null;
}

export function isReaderTranslatedRegionEvent(event) {
  return Boolean(findTranslatedRegionAtPoint(event));
}

function drawRegionBox(controller, regionPart, layerClassName, boxClassName) {
  if (!controller || !regionPart) {
    return;
  }
  const pageElement = controller.viewerElement.querySelector(`.page[data-page-number="${regionPart.page}"]`);
  const canvasBox = getPageCanvasBoxWithPdfSize(controller, pageElement, regionPart.page);
  if (!pageElement || !canvasBox) {
    return;
  }
  const layer = ensureRegionLayer(pageElement, layerClassName);
  const box = document.createElement("div");
  box.className = boxClassName;
  if (placeRegionBox(box, regionPart.bbox, canvasBox)) {
    layer.appendChild(box);
  }
}

function showReaderRegionToast(controller, regionPart, message) {
  if (!controller || !regionPart || !message) {
    return;
  }
  const pageElement = controller.viewerElement.querySelector(`.page[data-page-number="${regionPart.page}"]`);
  const canvasBox = getPageCanvasBoxWithPdfSize(controller, pageElement, regionPart.page);
  if (!pageElement || !canvasBox) {
    return;
  }
  const rect = regionRectFromBox(regionPart.bbox, canvasBox);
  if (!rect) {
    return;
  }
  const layer = ensureRegionLayer(pageElement, "reader-translated-highlight-layer");
  layer.querySelectorAll(".reader-region-copy-toast").forEach((element) => element.remove());
  const toast = document.createElement("div");
  toast.className = "reader-region-copy-toast";
  toast.textContent = message;
  toast.style.left = `${Math.max(canvasBox.left + 8, rect.left + (rect.right - rect.left) / 2)}px`;
  toast.style.top = `${Math.max(canvasBox.top + 8, rect.top + 6)}px`;
  layer.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("is-leaving");
  }, 760);
  window.setTimeout(() => {
    toast.remove();
  }, 1100);
}

function clearActiveRegionHighlights() {
  const binding = readerRegionBinding;
  clearRegionLayers(binding?.sourceController, "reader-source-highlight-layer");
  clearRegionLayers(binding?.translatedController, "reader-translated-highlight-layer");
}

function showReaderRegionPair(region) {
  const binding = readerRegionBinding;
  if (!binding || !region) {
    return;
  }
  clearActiveRegionHighlights();
  drawRegionBox(
    binding.sourceController,
    region.source,
    "reader-source-highlight-layer",
    "reader-region-highlight-box",
  );
  drawRegionBox(
    binding.translatedController,
    region.translated,
    "reader-translated-highlight-layer",
    "reader-region-highlight-box",
  );
}

function hideReaderRegionPair() {
  if (selectedReaderRegion) {
    showReaderRegionPair(selectedReaderRegion);
    return;
  }
  clearActiveRegionHighlights();
}

function handleTranslatedRegionMouseMove(event) {
  const region = findTranslatedRegionAtPoint(event);
  if (region?.itemId === hoveredReaderRegion?.itemId) {
    return;
  }
  hoveredReaderRegion = region;
  if (region) {
    showReaderRegionPair(region);
  } else {
    hideReaderRegionPair();
  }
}

function handleTranslatedRegionMouseLeave() {
  hoveredReaderRegion = null;
  hideReaderRegionPair();
}

function selectReaderRegion(region) {
  selectedReaderRegion = selectedReaderRegion?.itemId === region?.itemId ? null : region;
  if (selectedReaderRegion) {
    showReaderRegionPair(selectedReaderRegion);
  } else {
    clearActiveRegionHighlights();
  }
}

function handleTranslatedRegionClick(event) {
  const region = findTranslatedRegionAtPoint(event);
  if (!region) {
    return;
  }
  selectReaderRegion(region);
}

async function fetchReaderRegionPayload(region) {
  if (region?.markdown || region?.source?.text || region?.translated?.text) {
    return region;
  }
  const binding = readerRegionBinding;
  if (!binding?.jobId || !binding?.fetchTranslationItem || !region?.itemId) {
    return null;
  }
  const cacheKey = `${binding.jobId}:${region.itemId}`;
  if (readerRegionItemCache.has(cacheKey)) {
    return readerRegionItemCache.get(cacheKey);
  }
  const request = binding.fetchTranslationItem(binding.jobId, region.itemId, binding.apiPrefix);
  readerRegionItemCache.set(cacheKey, request);
  return request;
}

async function handleTranslatedRegionDoubleClick(event) {
  const region = findTranslatedRegionAtPoint(event);
  if (!region) {
    return;
  }
  event.preventDefault();
  showReaderRegionPair(region);
    try {
      const payload = await fetchReaderRegionPayload(region);
      const formatted = formatReaderRegionMarkdownPayload(payload);
      await copyTextToClipboard(formatted.translated || formatted.primaryText);
      showReaderRegionToast(readerRegionBinding?.translatedController, region.translated, "Đã sao chép");
    } catch {
      showReaderRegionToast(readerRegionBinding?.translatedController, region.translated, "Sao chép thất bại");
      // Keep text selection behavior unaffected if copy is unavailable.
    }
}

  async function showReaderRegionMarkdown(event, region) {
    event.preventDefault();
    event.stopPropagation();
    showReaderRegionPair(region);
    const binding = readerRegionBinding;
    if (!binding?.jobId || !binding?.fetchTranslationItem || !region?.itemId) {
      renderReaderMarkdownPopover(event, region, { message: "Thiếu item_id, không thể đọc văn bản" });
      return;
    }
    const popover = renderReaderMarkdownPopover(event, region, { message: "Đang đọc..." });
    try {
      const payload = await fetchReaderRegionPayload(region);
      renderReaderMarkdownPayload(popover, payload);
    } catch (error) {
      popover.querySelector(".reader-region-markdown-body").textContent = error?.message || "Không thể đọc";
    }
  }

export function scheduleRegionOverlayRender() {
  if (!readerRegionBinding || regionOverlayTicking) {
    return;
  }
  regionOverlayTicking = true;
  window.requestAnimationFrame(() => {
    regionOverlayTicking = false;
    if (hoveredReaderRegion) {
      showReaderRegionPair(hoveredReaderRegion);
    } else if (selectedReaderRegion) {
      showReaderRegionPair(selectedReaderRegion);
    }
  });
}

export function bindReaderRegionHover({
  regions,
  sourceController,
  translatedController,
  jobId = "",
  apiPrefix = "",
  fetchTranslationItem = null,
}: {
  regions?: unknown;
  sourceController?: { viewerElement?: HTMLElement | null; [key: string]: unknown } | null;
  translatedController?: { viewerElement?: HTMLElement | null; [key: string]: unknown } | null;
  jobId?: string;
  apiPrefix?: string;
  fetchTranslationItem?: ((...args: unknown[]) => Promise<unknown>) | null;
} = {}) {
  const normalizedRegions = normalizeReaderRegions(regions);
  if (!normalizedRegions.length || !sourceController || !translatedController) {
    return;
  }
  readerRegionBinding = {
    regions: normalizedRegions,
    sourceController,
    translatedController,
    jobId,
    apiPrefix,
    fetchTranslationItem,
  };
  selectedReaderRegion = null;
  hoveredReaderRegion = null;
  if (translatedController.viewerElement.dataset.readerRegionHitTestBound !== "1") {
    translatedController.viewerElement.dataset.readerRegionHitTestBound = "1";
    translatedController.viewerElement.addEventListener("mousemove", handleTranslatedRegionMouseMove);
    translatedController.viewerElement.addEventListener("mouseleave", handleTranslatedRegionMouseLeave);
    translatedController.viewerElement.addEventListener("click", handleTranslatedRegionClick);
    translatedController.viewerElement.addEventListener("dblclick", handleTranslatedRegionDoubleClick);
    translatedController.viewerElement.addEventListener("mousedown", (event) => {
      if (event.button === 2 && findTranslatedRegionAtPoint(event)) {
        event.stopPropagation();
      }
    });
    translatedController.viewerElement.addEventListener("contextmenu", (event) => {
      const region = findTranslatedRegionAtPoint(event);
      if (region) {
        event.stopPropagation();
        showReaderRegionMarkdown(event, region);
      }
    });
  }
  scheduleRegionOverlayRender();
}

// ===== Định vị neo và trích xuất vùng chọn (khả năng tiền đề dùng chung cho thu thập/tìm kiếm/trúng mục chú thích) =====

// ID khối có số chữ số 0 khác nhau trong 2 bộ sản phẩm: itemId trong regions là 3 chữ số (p001-b002),
// block_id trong FTS/Thu thập/Trích dẫn của máy chủ là 4 chữ số (p001-b0002). Thống nhất về
// khóa số thuần túy "p<trang>-b<khối>" để so sánh, nếu không neo chéo hệ thống sẽ không bao giờ khớp.
const BLOCK_KEY_RE = /^p0*(\d+)-b0*(\d+)$/i;

export function normalizeBlockKey(blockId) {
  const match = BLOCK_KEY_RE.exec(`${blockId || ""}`.trim());
  return match ? `p${Number(match[1])}-b${Number(match[2])}` : `${blockId || ""}`.trim();
}

// Cuộn theo neo (pageIdx, blockId) về vị trí gốc và tô sáng tạm thời vùng trúng.
// blockId ↔ region.itemId (không nhạy cảm với số chữ số 0); nếu không tìm thấy vùng, quay lại định vị toàn trang.
export function jumpToReaderAnchor(anchor: PageAnchor = {}) {
  const binding = readerRegionBinding;
  const blockKey = normalizeBlockKey(anchor?.blockId);
  const region = blockKey
    ? binding?.regions?.find((item) => normalizeBlockKey(item.itemId) === blockKey) || null
    : null;
  const pageIdx = Number(anchor?.pageIdx);
  const pageNumber = region?.source?.page
    || (Number.isFinite(pageIdx) && pageIdx >= 0 ? pageIdx + 1 : 0);
  if (!pageNumber) {
    return false;
  }
  const controller = binding?.sourceController;
  const pageElement = controller?.viewerElement?.querySelector?.(
    `.page[data-page-number="${pageNumber}"]`,
  ) || document.querySelector(`#reader-pdf-viewer .page[data-page-number="${pageNumber}"]`);
  if (!pageElement) {
    return false;
  }
  pageElement.scrollIntoView?.({ block: "center", behavior: "auto" });
  if (region) {
    showReaderRegionPair(region);
    window.setTimeout(() => {
      hideReaderRegionPair();
    }, 1800);
  }
  return true;
}

// Trích xuất trích dẫn từ vùng chọn trang gốc: trúng với region giao với vùng chọn, ghép văn bản trích dẫn và khối chính.
// rect của vùng chọn là tọa độ pixel tương đối với phần tử trang (hệ tọa độ của selection-favorites).
export function resolveSelectionQuote({ page = 0, rect = null }: {
  page?: number;
  rect?: PixelRect | null;
} = {}): SelectionQuote | null {
  const binding = readerRegionBinding;
  const pageNumber = Number(page) || 0;
  if (!binding || !pageNumber || !rect) {
    return null;
  }
  const controller = binding.sourceController;
  const pageElement = controller?.viewerElement?.querySelector?.(
    `.page[data-page-number="${pageNumber}"]`,
  );
  const canvasBox = getPageCanvasBoxWithPdfSize(controller, pageElement, pageNumber);
  if (!canvasBox) {
    return null;
  }
  const selectionBox = {
    left: Number(rect.left) || 0,
    top: Number(rect.top) || 0,
    right: (Number(rect.left) || 0) + (Number(rect.width) || 0),
    bottom: (Number(rect.top) || 0) + (Number(rect.height) || 0),
  };
  const matches = [];
  for (const region of binding.regions || []) {
    if (region.source.page !== pageNumber) {
      continue;
    }
    const regionRect = regionRectFromBox(region.source.bbox, canvasBox);
    if (!regionRect) {
      continue;
    }
    const overlaps = regionRect.left < selectionBox.right
      && regionRect.right > selectionBox.left
      && regionRect.top < selectionBox.bottom
      && regionRect.bottom > selectionBox.top;
    if (overlaps) {
      matches.push({ region, top: regionRect.top });
    }
  }
  if (!matches.length) {
    return null;
  }
  matches.sort((a, b) => a.top - b.top);
  const regions = matches.map((match) => match.region);
  return {
    blockId: regions[0].itemId,
    pageIdx: pageNumber - 1,
    quoteText: regions.map((region) => region.source.text).filter(Boolean).join("\n"),
    translatedQuoteText: regions.map((region) => region.translated.text).filter(Boolean).join("\n"),
  };
}
