import * as pdfjsLib from "../../vendor/pdfjs-dist/build/pdf.mjs";
import {
  EventBus,
  PDFLinkService,
  PDFViewer,
} from "../../vendor/pdfjs-dist/web/pdf_viewer.mjs";
import { apiBase, buildApiHeaders } from "./config.js";
import { $ } from "./dom.js";
import {
  showReaderPaneEmpty,
  showReaderPaneReady,
} from "./reader-view.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../../vendor/pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

const PDFJS_CMAP_URL = new URL("../../vendor/pdfjs-dist/cmaps/", import.meta.url).toString();
const PDFJS_STANDARD_FONT_DATA_URL = new URL("../../vendor/pdfjs-dist/standard_fonts/", import.meta.url).toString();
const PDF_TO_CSS_UNITS = 96 / 72;
const MAX_READER_CANVAS_PIXELS = 4096 * 4096;
const READER_RANGE_CHUNK_SIZE = 512 * 1024;

const viewerControllers = new Map();
let resizeTicking = false;
let pageRowSyncTicking = false;
let regionOverlayTicking = false;
let readerRegionBinding = null;
let selectedReaderRegion = null;

export function resolveReaderArtifactUrl(item) {
  const raw = `${item?.resource_url || item?.resource_path || ""}`.trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `${apiBase()}${raw}`;
  }
  return `${apiBase()}/${raw.replace(/^\.?\//, "")}`;
}

function getViewerController(key) {
  return viewerControllers.get(key) || null;
}

function applyViewerScale(controller) {
  if (!controller?.viewer || !controller.basePageWidth) {
    return;
  }
  const hostWidth = Math.max(320, controller.viewerHost.clientWidth || 0);
  const availableWidth = Math.max(280, hostWidth - 12);
  const scale = availableWidth / (controller.basePageWidth * PDF_TO_CSS_UNITS);
  controller.viewer.currentScale = Math.max(0.35, Math.min(2.4, scale));
  schedulePageRowSync();
}

function resetSyncedPageHeights() {
  viewerControllers.forEach((controller) => {
    controller.viewerElement.querySelectorAll(".page").forEach((page) => {
      page.style.minHeight = "";
    });
  });
}

function syncReaderPageRows() {
  const rows = new Map();
  resetSyncedPageHeights();
  viewerControllers.forEach((controller) => {
    controller.viewerElement.querySelectorAll(".page[data-page-number]").forEach((page) => {
      const pageNumber = page.getAttribute("data-page-number") || "";
      if (!pageNumber) {
        return;
      }
      const height = page.getBoundingClientRect().height;
      if (!Number.isFinite(height) || height <= 0) {
        return;
      }
      const row = rows.get(pageNumber) || { height: 0, pages: [] };
      row.height = Math.max(row.height, height);
      row.pages.push(page);
      rows.set(pageNumber, row);
    });
  });
  rows.forEach((row) => {
    if (row.pages.length < 2 || row.height <= 0) {
      return;
    }
    const height = `${Math.ceil(row.height)}px`;
    row.pages.forEach((page) => {
      page.style.minHeight = height;
    });
  });
}

function schedulePageRowSync() {
  if (pageRowSyncTicking) {
    return;
  }
  pageRowSyncTicking = true;
  window.requestAnimationFrame(() => {
    pageRowSyncTicking = false;
    syncReaderPageRows();
  });
}

function pageNumberOfElement(pageElement) {
  return Number(pageElement?.getAttribute?.("data-page-number") || 0);
}

function getPageCanvasBox(pageElement) {
  const canvas = pageElement?.querySelector?.("canvas");
  const pageRect = pageElement?.getBoundingClientRect?.();
  const rect = canvas?.getBoundingClientRect?.();
  if (!rect || !pageRect || rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    left: rect.left - pageRect.left,
    top: rect.top - pageRect.top,
    width: rect.width,
    height: rect.height,
    pdfWidth: 0,
    pdfHeight: 0,
  };
}

function getPdfPageView(controller, pageNumber) {
  return controller?.viewer?.getPageView?.(Number(pageNumber) - 1) || null;
}

function getPageCanvasBoxWithPdfSize(controller, pageElement, pageNumber) {
  const canvasBox = getPageCanvasBox(pageElement);
  const pageView = getPdfPageView(controller, pageNumber);
  const viewport = pageView?.pdfPage?.getViewport?.({ scale: 1 });
  if (!canvasBox || !viewport?.width || !viewport?.height) {
    return canvasBox;
  }
  return {
    ...canvasBox,
    pdfWidth: viewport.width,
    pdfHeight: viewport.height,
  };
}

function ensureRegionLayer(pageElement, className) {
  let layer = pageElement.querySelector(`.${className}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = className;
    pageElement.appendChild(layer);
  }
  return layer;
}

function clearRegionLayers(controller, className) {
  controller?.viewerElement.querySelectorAll(`.${className}`).forEach((layer) => {
    layer.innerHTML = "";
  });
}

function normalizeReaderRegions(regions) {
  return (Array.isArray(regions) ? regions : [])
    .map((region) => {
      const sourcePage = Number(region?.source?.page || 0);
      const translatedPage = Number(region?.translated?.page || 0);
      const sourceBox = Array.isArray(region?.source?.bbox) ? region.source.bbox.map(Number) : [];
      const translatedBox = Array.isArray(region?.translated?.bbox) ? region.translated.bbox.map(Number) : [];
      if (
        !sourcePage
        || !translatedPage
        || sourceBox.length !== 4
        || translatedBox.length !== 4
        || !sourceBox.every(Number.isFinite)
        || !translatedBox.every(Number.isFinite)
      ) {
        return null;
      }
      return {
        itemId: `${region?.item_id || ""}`,
        source: { page: sourcePage, bbox: sourceBox },
        translated: { page: translatedPage, bbox: translatedBox },
      };
    })
    .filter(Boolean);
}

function placeRegionBox(element, bbox, canvasBox) {
  if (!element || !canvasBox) {
    return false;
  }
  const [x0, y0, x1, y1] = bbox;
  const pageWidth = Number(canvasBox.pdfWidth || 0);
  const pageHeight = Number(canvasBox.pdfHeight || 0);
  if (!pageWidth || !pageHeight) {
    return false;
  }
  const widthScale = canvasBox.width / pageWidth;
  const heightScale = canvasBox.height / pageHeight;
  const left = x0 * widthScale;
  const top = y0 * heightScale;
  const width = (x1 - x0) * widthScale;
  const height = (y1 - y0) * heightScale;
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return false;
  }
  element.style.left = `${canvasBox.left + left}px`;
  element.style.top = `${canvasBox.top + top}px`;
  element.style.width = `${Math.max(1, width)}px`;
  element.style.height = `${Math.max(1, height)}px`;
  return true;
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

function selectReaderRegion(region) {
  selectedReaderRegion = selectedReaderRegion?.itemId === region?.itemId ? null : region;
  if (selectedReaderRegion) {
    showReaderRegionPair(selectedReaderRegion);
  } else {
    clearActiveRegionHighlights();
  }
}

function renderTranslatedRegionTargets() {
  const binding = readerRegionBinding;
  if (!binding?.translatedController || !binding.regions.length) {
    return;
  }
  clearRegionLayers(binding.translatedController, "reader-translated-region-layer");
  const byTranslatedPage = new Map();
  binding.regions.forEach((region) => {
    const pageRegions = byTranslatedPage.get(region.translated.page) || [];
    pageRegions.push(region);
    byTranslatedPage.set(region.translated.page, pageRegions);
  });
  binding.translatedController.viewerElement.querySelectorAll(".page[data-page-number]").forEach((pageElement) => {
    const pageNumber = pageNumberOfElement(pageElement);
    const pageRegions = byTranslatedPage.get(pageNumber) || [];
    if (!pageRegions.length) {
      return;
    }
    const canvasBox = getPageCanvasBoxWithPdfSize(binding.translatedController, pageElement, pageNumber);
    if (!canvasBox) {
      return;
    }
    const layer = ensureRegionLayer(pageElement, "reader-translated-region-layer");
    pageRegions.forEach((region) => {
      const target = document.createElement("button");
      target.type = "button";
      target.className = "reader-translated-region-target";
      target.setAttribute("aria-label", region.itemId ? `高亮原文 ${region.itemId}` : "高亮原文");
      target.addEventListener("mouseenter", () => showReaderRegionPair(region));
      target.addEventListener("focus", () => showReaderRegionPair(region));
      target.addEventListener("mouseleave", hideReaderRegionPair);
      target.addEventListener("blur", hideReaderRegionPair);
      target.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectReaderRegion(region);
      });
      if (placeRegionBox(target, region.translated.bbox, canvasBox)) {
        layer.appendChild(target);
      }
    });
  });
}

function scheduleRegionOverlayRender() {
  if (!readerRegionBinding || regionOverlayTicking) {
    return;
  }
  regionOverlayTicking = true;
  window.requestAnimationFrame(() => {
    regionOverlayTicking = false;
    renderTranslatedRegionTargets();
  });
}

export function scheduleScaleRefresh() {
  if (resizeTicking) {
    return;
  }
  resizeTicking = true;
  window.requestAnimationFrame(() => {
    resizeTicking = false;
    viewerControllers.forEach((controller) => {
      applyViewerScale(controller);
    });
    schedulePageRowSync();
  });
}

export function bindPrimaryViewer(controller, onPageChange) {
  if (!controller) {
    return;
  }
  controller.eventBus.on("pagechanging", ({ pageNumber }) => {
    onPageChange?.(pageNumber || 1);
  });
}

function createViewerController(key) {
  const scrollShell = $("reader-scroll-shell");
  const viewerHost = $(`${key}-viewer-host`);
  const viewerElement = $(`${key}-viewer`);
  if (!scrollShell || !viewerHost || !viewerElement) {
    return null;
  }

  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus });
  const viewer = new PDFViewer({
    container: scrollShell,
    viewer: viewerElement,
    eventBus,
    linkService,
    textLayerMode: 1,
    annotationMode: 2,
    removePageBorders: true,
    maxCanvasPixels: MAX_READER_CANVAS_PIXELS,
  });
  linkService.setViewer(viewer);

  const controller = {
    key,
    eventBus,
    linkService,
    viewer,
    viewerHost,
    viewerElement,
    basePageWidth: 0,
  };
  eventBus.on("pagesinit", () => {
    applyViewerScale(controller);
    schedulePageRowSync();
    scheduleRegionOverlayRender();
  });
  eventBus.on("pagesloaded", () => {
    schedulePageRowSync();
    scheduleRegionOverlayRender();
  });
  eventBus.on("pagerendered", () => {
    schedulePageRowSync();
    scheduleRegionOverlayRender();
  });
  eventBus.on("scalechanging", () => {
    schedulePageRowSync();
    scheduleRegionOverlayRender();
  });
  viewerControllers.set(key, controller);
  return controller;
}

async function loadPdfDocument({ itemOrUrl }) {
  const url = typeof itemOrUrl === "string" ? itemOrUrl : resolveReaderArtifactUrl(itemOrUrl);
  if (!url) {
    return null;
  }
  return pdfjsLib.getDocument({
    url,
    httpHeaders: buildApiHeaders(),
    withCredentials: false,
    disableRange: false,
    disableStream: false,
    rangeChunkSize: READER_RANGE_CHUNK_SIZE,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
  }).promise;
}

export async function mountPdfViewer({
  key,
  itemOrUrl,
  label,
  emptyId,
}) {
  const viewerWrap = $(`${key}-wrap`);
  const empty = $(emptyId);
  const controller = getViewerController(key) || createViewerController(key);
  if (!viewerWrap || !empty || !controller) {
    return null;
  }

  void label;
  const pdfDocument = await loadPdfDocument({ itemOrUrl });
  if (!pdfDocument) {
    showReaderPaneEmpty(key, emptyId);
    return null;
  }

  const firstPage = await pdfDocument.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  controller.basePageWidth = firstViewport.width;
  controller.linkService.setDocument(pdfDocument);
  controller.viewer.setDocument(pdfDocument);
  applyViewerScale(controller);

  showReaderPaneReady(key, emptyId);

  return {
    key,
    pagesCount: pdfDocument.numPages,
    controller,
  };
}

export function bindResizeRefresh() {
  window.addEventListener("resize", scheduleScaleRefresh);
}

export function bindReaderRegionHover({ regions, sourceController, translatedController } = {}) {
  const normalizedRegions = normalizeReaderRegions(regions);
  if (!normalizedRegions.length || !sourceController || !translatedController) {
    return;
  }
  readerRegionBinding = {
    regions: normalizedRegions,
    sourceController,
    translatedController,
  };
  selectedReaderRegion = null;
  scheduleRegionOverlayRender();
}
