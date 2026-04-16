import * as pdfjsLib from "../../node_modules/pdfjs-dist/build/pdf.mjs";
import {
  EventBus,
  PDFLinkService,
  PDFViewer,
} from "../../node_modules/pdfjs-dist/web/pdf_viewer.mjs";
import { apiBase, isMockMode, readerMessageTargetOrigin } from "./config.js";
import { $ } from "./dom.js";
import { API_PREFIX } from "./constants.js";
import { resolveJobActions } from "./job.js";
import { getMockJobId } from "./mock.js";
import { fetchJobArtifactsManifest, fetchJobPayload, fetchProtected } from "./network.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../../node_modules/pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();
const PDFJS_CMAP_URL = new URL("../../node_modules/pdfjs-dist/cmaps/", import.meta.url).toString();
const PDFJS_STANDARD_FONT_DATA_URL = new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).toString();

const PDF_TO_CSS_UNITS = 96 / 72;

const readerState = {
  totalPages: 0,
  currentPage: 0,
  primaryViewerKey: "",
  resizeTicking: false,
};

const viewerControllers = new Map();
const progressState = {
  metadataReady: false,
  sourceDone: false,
  translatedDone: false,
};
const bootProgressBarState = {
  value: 0,
  target: 0,
  rafId: 0,
};
const progressCopy = {
  boot: "正在准备对照阅读…",
  metadata: "正在读取任务信息…",
  both: "正在加载原始 PDF 和译文 PDF…",
  sourceOnly: "原始 PDF 已加载，正在加载译文 PDF…",
  translatedOnly: "译文 PDF 已加载，正在加载原始 PDF…",
  ready: "对照阅读已就绪",
  failed: "对照阅读加载失败",
};

function setReaderBootLoading(loading) {
  const loadingEl = $("reader-boot-loading");
  if (!loadingEl) {
    return;
  }
  loadingEl.classList.toggle("hidden", !loading);
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function animateProgressValue(progressBarState, element, nextValue) {
  if (!element) {
    return;
  }
  const target = Math.max(0, Math.min(100, Number(nextValue) || 0));
  const from = Number(progressBarState.value) || 0;
  if (Math.abs(from - target) < 0.1) {
    progressBarState.value = target;
    progressBarState.target = target;
    element.style.width = `${target}%`;
    return;
  }
  progressBarState.target = target;
  if (progressBarState.rafId) {
    cancelAnimationFrame(progressBarState.rafId);
    progressBarState.rafId = 0;
  }
  const duration = Math.max(220, Math.min(520, Math.abs(target - from) * 10));
  const startedAt = performance.now();

  const tick = (now) => {
    const elapsed = now - startedAt;
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const eased = easeOutCubic(t);
    const value = from + ((target - from) * eased);
    progressBarState.value = value;
    element.style.width = `${value}%`;
    if (t < 1) {
      progressBarState.rafId = requestAnimationFrame(tick);
      return;
    }
    progressBarState.value = target;
    progressBarState.rafId = 0;
    element.style.width = `${target}%`;
  };

  progressBarState.rafId = requestAnimationFrame(tick);
}

function applyReaderBootProgress(percent, text, stage = "progress") {
  $("reader-boot-loading-text").textContent = text;
  animateProgressValue(bootProgressBarState, $("reader-boot-loading-bar"), percent);
  try {
    window.parent?.postMessage({
      type: "retainpdf-reader-progress",
      stage,
      percent,
      text,
    }, readerMessageTargetOrigin());
  } catch (_err) {
    // Ignore cross-frame reporting failures.
  }
}

function computeReaderProgressSnapshot() {
  if (!progressState.metadataReady) {
    return { percent: 8, text: progressCopy.boot, stage: "boot" };
  }
  const completedPdfs = Number(progressState.sourceDone) + Number(progressState.translatedDone);
  const percent = 24 + completedPdfs * 30;
  if (completedPdfs === 0) {
    return { percent, text: progressCopy.both, stage: "pdfs" };
  }
  if (completedPdfs === 1) {
    return {
      percent,
      text: progressState.sourceDone ? progressCopy.sourceOnly : progressCopy.translatedOnly,
      stage: "pdfs",
    };
  }
  return { percent: 92, text: progressCopy.ready, stage: "readying" };
}

function syncReaderBootProgress() {
  const snapshot = computeReaderProgressSnapshot();
  applyReaderBootProgress(snapshot.percent, snapshot.text, snapshot.stage);
}

function getJobIdFromQuery() {
  const jobId = new URLSearchParams(window.location.search).get("job_id")?.trim() || "";
  if (jobId) {
    return jobId;
  }
  return isMockMode() ? getMockJobId() : "";
}

function findArtifact(manifestPayload, artifactKey) {
  const items = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];
  return items.find((entry) => entry?.artifact_key === artifactKey && entry?.ready) || null;
}

function resolveArtifactUrl(item) {
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

function resolveTranslatedPdfUrl(jobPayload, manifestPayload) {
  const actions = jobPayload ? resolveJobActions(jobPayload) : null;
  if (actions?.pdfEnabled && actions?.pdf) {
    return actions.pdf;
  }
  const manifestCandidates = ["pdf", "translated_pdf", "result_pdf"];
  for (const artifactKey of manifestCandidates) {
    const item = findArtifact(manifestPayload, artifactKey);
    const url = resolveArtifactUrl(item);
    if (url) {
      return url;
    }
  }
  return "";
}

function setPageIndicator(currentPage, totalPages) {
  const indicator = $("reader-page-indicator");
  if (!indicator || !totalPages) {
    indicator?.classList.add("hidden");
    return;
  }
  indicator.textContent = `第 ${currentPage} / ${totalPages} 页`;
  indicator.classList.remove("hidden");
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

function scheduleScaleRefresh() {
  if (readerState.resizeTicking) {
    return;
  }
  readerState.resizeTicking = true;
  window.requestAnimationFrame(() => {
    readerState.resizeTicking = false;
    viewerControllers.forEach((controller) => {
      applyViewerScale(controller);
    });
  });
}

function bindPrimaryViewer(controller) {
  if (!controller) {
    return;
  }
  readerState.primaryViewerKey = controller.key;
  controller.eventBus.on("pagechanging", ({ pageNumber }) => {
    readerState.currentPage = pageNumber || 1;
    setPageIndicator(readerState.currentPage, readerState.totalPages);
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

async function loadPdfDocument(itemOrUrl, label) {
  const url = typeof itemOrUrl === "string" ? itemOrUrl : resolveArtifactUrl(itemOrUrl);
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

async function mountPdfViewer(key, itemOrUrl, label, emptyId) {
  const viewerWrap = $(`${key}-wrap`);
  const empty = $(emptyId);
  const controller = getViewerController(key) || createViewerController(key);
  if (!viewerWrap || !empty || !controller) {
    return null;
  }

  const pdfDocument = await loadPdfDocument(itemOrUrl, label);
  if (!pdfDocument) {
    viewerWrap.classList.add("hidden");
    empty.classList.remove("hidden");
    return null;
  }

  const firstPage = await pdfDocument.getPage(1);
  controller.basePageWidth = firstPage.getViewport({ scale: 1 }).width;
  controller.linkService.setDocument(pdfDocument);
  controller.viewer.setDocument(pdfDocument);
  applyViewerScale(controller);

  viewerWrap.classList.remove("hidden");
  empty.classList.add("hidden");

  return {
    key,
    pagesCount: pdfDocument.numPages,
    controller,
  };
}

function bindResizeRefresh() {
  window.addEventListener("resize", scheduleScaleRefresh);
}

async function initializeReader() {
  bindResizeRefresh();
  setReaderBootLoading(true);
  progressState.metadataReady = false;
  progressState.sourceDone = false;
  progressState.translatedDone = false;
  syncReaderBootProgress();

  const jobId = getJobIdFromQuery();
  if (!jobId) {
    $("reader-pdf-empty")?.classList.remove("hidden");
    $("reader-translation-empty")?.classList.remove("hidden");
    applyReaderBootProgress(100, progressCopy.failed, "failed");
    setReaderBootLoading(false);
    return;
  }

  try {
    applyReaderBootProgress(14, progressCopy.metadata, "metadata");
    const [jobPayload, manifestPayload] = await Promise.all([
      fetchJobPayload(jobId, API_PREFIX),
      fetchJobArtifactsManifest(jobId, API_PREFIX),
    ]);
    progressState.metadataReady = true;
    syncReaderBootProgress();

    const sourcePdf = findArtifact(manifestPayload, "source_pdf");
    const translatedPdfUrl = resolveTranslatedPdfUrl(jobPayload, manifestPayload);

    const [sourceResult, translatedResult] = await Promise.allSettled([
      mountPdfViewer("reader-pdf", sourcePdf, "原始 PDF", "reader-pdf-empty").finally(() => {
        progressState.sourceDone = true;
        syncReaderBootProgress();
      }),
      mountPdfViewer("reader-translated-pdf", translatedPdfUrl, "译文 PDF", "reader-translation-empty").finally(() => {
        progressState.translatedDone = true;
        syncReaderBootProgress();
      }),
    ]);

    const sourceReady = sourceResult.status === "fulfilled" ? sourceResult.value : null;
    const translatedReady = translatedResult.status === "fulfilled" ? translatedResult.value : null;

    if (!sourceReady) {
      $("reader-pdf-wrap")?.classList.add("hidden");
      $("reader-pdf-empty")?.classList.remove("hidden");
    }
    if (!translatedReady) {
      $("reader-translated-pdf-wrap")?.classList.add("hidden");
      $("reader-translation-empty")?.classList.remove("hidden");
    }
    if (!sourceReady && !translatedReady) {
      return;
    }

    const primary = sourceReady || translatedReady;
    readerState.primaryViewerKey = primary.key;
    readerState.totalPages = primary.pagesCount || 0;
    readerState.currentPage = 1;
    bindPrimaryViewer(primary.controller);
    setPageIndicator(1, readerState.totalPages);
    scheduleScaleRefresh();
    applyReaderBootProgress(100, progressCopy.ready, "ready");
    setReaderBootLoading(false);
  } catch (_err) {
    $("reader-pdf-empty")?.classList.remove("hidden");
    $("reader-translation-empty")?.classList.remove("hidden");
    applyReaderBootProgress(100, progressCopy.failed, "failed");
    setReaderBootLoading(false);
  }
}

initializeReader();
