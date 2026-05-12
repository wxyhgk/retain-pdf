import { isMockMode, readerMessageTargetOrigin } from "./config.js";
import { API_PREFIX } from "./constants.js";
import {
  findReadyManifestArtifact,
  resolveManifestArtifactUrl,
} from "./job-artifacts.js";
import { resolveJobActions } from "./job.js";
import { getMockJobId } from "./mock.js";
import { fetchJobArtifactsManifest, fetchJobPayload, fetchProtected } from "./network.js";
import {
  bindPrimaryViewer,
  bindResizeRefresh,
  mountPdfViewer,
  resolveReaderArtifactUrl,
  scheduleScaleRefresh,
} from "./reader-pdf.js";
import {
  animateReaderProgressValue,
  setPageIndicator,
  setReaderBootLoading,
  setReaderBootProgressText,
  showBothReaderEmpty,
  showReaderPaneEmpty,
} from "./reader-view.js";

const readerState = {
  totalPages: 0,
  currentPage: 0,
  primaryViewerKey: "",
};

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

function applyReaderBootProgress(percent, text, stage = "progress") {
  setReaderBootProgressText(text);
  animateReaderProgressValue(bootProgressBarState, percent);
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

function resolveTranslatedPdfUrl(jobPayload, manifestPayload) {
  const actions = jobPayload ? resolveJobActions(jobPayload) : null;
  if (actions?.pdfEnabled && actions?.pdf) {
    return actions.pdf;
  }
  const manifestCandidates = ["pdf", "translated_pdf", "result_pdf"];
  for (const artifactKey of manifestCandidates) {
    const item = findReadyManifestArtifact(manifestPayload, artifactKey);
    const url = resolveReaderArtifactUrl(item);
    if (url) {
      return url;
    }
  }
  return "";
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
    showBothReaderEmpty();
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

    const sourcePdf = resolveManifestArtifactUrl(manifestPayload, "source_pdf")
      || findReadyManifestArtifact(manifestPayload, "source_pdf");
    const translatedPdfUrl = resolveTranslatedPdfUrl(jobPayload, manifestPayload);

    const [sourceResult, translatedResult] = await Promise.allSettled([
      mountPdfViewer({
        key: "reader-pdf",
        itemOrUrl: sourcePdf,
        label: "原始 PDF",
        emptyId: "reader-pdf-empty",
        fetchProtected,
      }).finally(() => {
        progressState.sourceDone = true;
        syncReaderBootProgress();
      }),
      mountPdfViewer({
        key: "reader-translated-pdf",
        itemOrUrl: translatedPdfUrl,
        label: "译文 PDF",
        emptyId: "reader-translation-empty",
        fetchProtected,
      }).finally(() => {
        progressState.translatedDone = true;
        syncReaderBootProgress();
      }),
    ]);

    const sourceReady = sourceResult.status === "fulfilled" ? sourceResult.value : null;
    const translatedReady = translatedResult.status === "fulfilled" ? translatedResult.value : null;

    if (!sourceReady) {
      showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
    }
    if (!translatedReady) {
      showReaderPaneEmpty("reader-translated-pdf", "reader-translation-empty");
    }
    if (!sourceReady && !translatedReady) {
      return;
    }

    const primary = sourceReady || translatedReady;
    readerState.primaryViewerKey = primary.key;
    readerState.totalPages = primary.pagesCount || 0;
    readerState.currentPage = 1;
    bindPrimaryViewer(primary.controller, (pageNumber) => {
      readerState.currentPage = pageNumber || 1;
      setPageIndicator(readerState.currentPage, readerState.totalPages);
    });
    setPageIndicator(1, readerState.totalPages);
    scheduleScaleRefresh();
    applyReaderBootProgress(100, progressCopy.ready, "ready");
    setReaderBootLoading(false);
  } catch (_err) {
    showBothReaderEmpty();
    applyReaderBootProgress(100, progressCopy.failed, "failed");
    setReaderBootLoading(false);
  }
}

initializeReader();
