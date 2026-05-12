import * as pdfjsLib from "../../vendor/pdfjs-dist/build/pdf.mjs";
import {
  EventBus,
  PDFLinkService,
  PDFViewer,
} from "../../vendor/pdfjs-dist/web/pdf_viewer.mjs";
import { apiBase } from "./config.js";
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

const viewerControllers = new Map();
let resizeTicking = false;

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
  });
  viewerControllers.set(key, controller);
  return controller;
}

async function loadPdfDocument({ fetchProtected, itemOrUrl, label }) {
  const url = typeof itemOrUrl === "string" ? itemOrUrl : resolveReaderArtifactUrl(itemOrUrl);
  if (!url) {
    return null;
  }
  const resp = await fetchProtected(url);
  if (!resp.ok) {
    throw new Error(`读取${label}失败。(${resp.status})`);
  }
  const buffer = await resp.arrayBuffer();
  return pdfjsLib.getDocument({
    data: buffer,
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
  fetchProtected,
}) {
  const viewerWrap = $(`${key}-wrap`);
  const empty = $(emptyId);
  const controller = getViewerController(key) || createViewerController(key);
  if (!viewerWrap || !empty || !controller) {
    return null;
  }

  const pdfDocument = await loadPdfDocument({ fetchProtected, itemOrUrl, label });
  if (!pdfDocument) {
    showReaderPaneEmpty(key, emptyId);
    return null;
  }

  const firstPage = await pdfDocument.getPage(1);
  controller.basePageWidth = firstPage.getViewport({ scale: 1 }).width;
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
