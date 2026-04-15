import { $ } from "../../dom.js";
import { buildFrontendPageUrl, isTrustedWindowMessage } from "../../config.js";
import { resolveJobActions } from "../../job.js";

let pdfDocumentModulePromise = null;

async function loadPdfDocument() {
  if (!pdfDocumentModulePromise) {
    pdfDocumentModulePromise = import("../../../../node_modules/pdf-lib/dist/pdf-lib.esm.js")
      .then((module) => module.PDFDocument);
  }
  return pdfDocumentModulePromise;
}

function fileNameFromDisposition(disposition, fallback) {
  if (!disposition || typeof disposition !== "string") {
    return fallback;
  }
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (_err) {
      return utf8Match[1];
    }
  }
  const plainMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  return plainMatch && plainMatch[1] ? plainMatch[1] : fallback;
}

function jobIdFromReaderUrl(url) {
  const raw = `${url || ""}`.trim();
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw, window.location.href).searchParams.get("job_id")?.trim() || "";
  } catch (_err) {
    return "";
  }
}

function stripExtension(filename) {
  const normalized = `${filename || ""}`.trim();
  if (!normalized) {
    return "";
  }
  const index = normalized.lastIndexOf(".");
  if (index <= 0) {
    return normalized;
  }
  return normalized.slice(0, index);
}

function sanitizeFilenamePart(value) {
  return `${value || ""}`.replace(/[\\/:*?"<>|]+/g, "_").trim();
}

function basenameFromUrlLike(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw, window.location.href);
    const pathname = parsed.pathname || "";
    const candidate = pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(candidate);
  } catch (_err) {
    const candidate = raw.split(/[/?#]/)[0]?.split("/").filter(Boolean).pop() || "";
    return candidate;
  }
}

function findManifestArtifact(manifestPayload, artifactKey) {
  const items = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];
  return items.find((entry) => entry?.artifact_key === artifactKey && entry?.ready) || null;
}

function resolveOriginalPdfName(state) {
  const snapshot = state.currentJobSnapshot || {};
  const requestPayload = snapshot.request_payload || {};
  const rawResponse = snapshot.raw_response || {};
  const sourceArtifact = findManifestArtifact(state.currentJobManifest, "source_pdf");
  const candidates = [
    state.uploadedFileName,
    rawResponse.filename,
    rawResponse.file_name,
    rawResponse.original_filename,
    rawResponse.original_file_name,
    requestPayload.filename,
    requestPayload.file_name,
    requestPayload.original_filename,
    requestPayload.original_file_name,
    requestPayload.source_filename,
    requestPayload.source_file_name,
    sourceArtifact?.filename,
    sourceArtifact?.file_name,
    sourceArtifact?.name,
    basenameFromUrlLike(sourceArtifact?.resource_path),
    basenameFromUrlLike(sourceArtifact?.resource_url),
  ];
  const originalName = candidates.find((value) => typeof value === "string" && value.trim()) || "";
  return sanitizeFilenamePart(stripExtension(originalName));
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function resolveManifestArtifactUrl(manifestPayload, artifactKey) {
  const items = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];
  const item = items.find((entry) => entry?.artifact_key === artifactKey && entry?.ready);
  return `${item?.resource_url || item?.resource_path || ""}`.trim();
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function animateProgressValue(progressState, element, nextValue) {
  if (!element) {
    return;
  }
  const target = Math.max(0, Math.min(100, Number(nextValue) || 0));
  const from = Number(progressState.value) || 0;
  if (Math.abs(from - target) < 0.1) {
    progressState.value = target;
    progressState.target = target;
    element.style.width = `${target}%`;
    return;
  }
  progressState.target = target;
  if (progressState.rafId) {
    cancelAnimationFrame(progressState.rafId);
    progressState.rafId = 0;
  }
  const duration = Math.max(220, Math.min(520, Math.abs(target - from) * 10));
  const startedAt = performance.now();

  const tick = (now) => {
    const elapsed = now - startedAt;
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const eased = easeOutCubic(t);
    const value = from + ((target - from) * eased);
    progressState.value = value;
    element.style.width = `${value}%`;
    if (t < 1) {
      progressState.rafId = requestAnimationFrame(tick);
      return;
    }
    progressState.value = target;
    progressState.rafId = 0;
    element.style.width = `${target}%`;
  };

  progressState.rafId = requestAnimationFrame(tick);
}

function currentReaderArtifactUrls(state) {
  const manifest = state.currentJobManifest;
  const job = state.currentJobSnapshot;
  const actions = job ? resolveJobActions(job) : null;
  const sourcePdf = resolveManifestArtifactUrl(manifest, "source_pdf");
  const translatedPdf = actions?.pdf || resolveManifestArtifactUrl(manifest, "pdf")
    || resolveManifestArtifactUrl(manifest, "translated_pdf")
    || resolveManifestArtifactUrl(manifest, "result_pdf");
  return { sourcePdf, translatedPdf };
}

async function downloadProtectedResource(fetchProtected, url, fallbackName, preferredName = "") {
  const resp = await fetchProtected(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get("content-disposition") || "";
  const finalName = `${preferredName || ""}`.trim() || fileNameFromDisposition(disposition, fallbackName);
  downloadBlob(blob, finalName);
}

async function fetchProtectedBytes(fetchProtected, url, label) {
  const resp = await fetchProtected(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`读取${label}失败: ${resp.status} ${text || "unknown error"}`);
  }
  return resp.arrayBuffer();
}

async function buildMergedComparePdf(sourceBytes, translatedBytes) {
  const PDFDocument = await loadPdfDocument();
  const mergedDoc = await PDFDocument.create();
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const translatedDoc = await PDFDocument.load(translatedBytes);
  const totalPages = Math.max(sourceDoc.getPageCount(), translatedDoc.getPageCount());

  for (let index = 0; index < totalPages; index += 1) {
    const sourceEmbedded = index < sourceDoc.getPageCount()
      ? (await mergedDoc.embedPdf(sourceBytes, [index]))[0]
      : null;
    const translatedEmbedded = index < translatedDoc.getPageCount()
      ? (await mergedDoc.embedPdf(translatedBytes, [index]))[0]
      : null;

    const sourceWidth = sourceEmbedded?.width || 0;
    const sourceHeight = sourceEmbedded?.height || 0;
    const translatedWidth = translatedEmbedded?.width || 0;
    const translatedHeight = translatedEmbedded?.height || 0;
    const pageWidth = Math.max(1, sourceWidth + translatedWidth);
    const pageHeight = Math.max(sourceHeight, translatedHeight, 1);
    const page = mergedDoc.addPage([pageWidth, pageHeight]);

    if (sourceEmbedded) {
      page.drawPage(sourceEmbedded, {
        x: 0,
        y: pageHeight - sourceHeight,
        width: sourceWidth,
        height: sourceHeight,
      });
    }
    if (translatedEmbedded) {
      page.drawPage(translatedEmbedded, {
        x: sourceWidth,
        y: pageHeight - translatedHeight,
        width: translatedWidth,
        height: translatedHeight,
      });
    }
  }

  return mergedDoc.save();
}

export function mountReaderDialogFeature({
  state,
  fetchProtected,
  setText,
}) {
  const progressState = {
    value: 0,
    target: 0,
    rafId: 0,
  };

  function readerDialogComponent() {
    return document.querySelector("reader-dialog");
  }

  function buildReaderPageUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    return buildFrontendPageUrl("./reader.html", {
      job_id: normalizedJobId,
    });
  }

  function buildReaderRouteUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    const url = new URL(window.location.href);
    if (!normalizedJobId) {
      url.searchParams.delete("view");
      url.searchParams.delete("job_id");
      return url.toString();
    }
    url.searchParams.set("job_id", normalizedJobId);
    url.searchParams.set("view", "reader");
    return url.toString();
  }

  function syncReaderRoute(jobId = "") {
    window.history.replaceState(window.history.state, "", buildReaderRouteUrl(jobId));
  }

  function setToolbarButtonState(id, enabled, url = "") {
    const component = readerDialogComponent();
    if (component?.setToolbarButtonState) {
      component.setToolbarButtonState(id, { enabled, url });
    } else {
      const button = $(id);
      if (!button) {
        return;
      }
      button.disabled = !enabled;
      button.dataset.url = enabled ? url : "";
    }
  }

  function setLoading(loading) {
    const component = readerDialogComponent();
    if (component?.setLoadingVisible) {
      component.setLoadingVisible(loading);
      return;
    }
    $("reader-dialog-loading")?.classList.toggle("hidden", !loading);
  }

  function setLoadingProgress(percent = 0, text = "正在准备对照阅读…") {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    const textEl = $("reader-dialog-loading-text");
    const barEl = $("reader-dialog-loading-bar");
    if (textEl) {
      textEl.textContent = text;
    }
    if (barEl) {
      animateProgressValue(progressState, barEl, safePercent);
    }
    const component = readerDialogComponent();
    if (component?.setLoadingProgress) {
      component.setLoadingProgress({
        text,
        percent: safePercent,
        widthPercent: progressState.value,
      });
    }
  }

  function syncToolbarActions() {
    const { sourcePdf, translatedPdf } = currentReaderArtifactUrls(state);
    setToolbarButtonState("reader-source-download-btn", !!sourcePdf, sourcePdf);
    setToolbarButtonState("reader-translated-download-btn", !!translatedPdf, translatedPdf);
    setToolbarButtonState("reader-merged-download-btn", !!sourcePdf && !!translatedPdf);
  }

  async function handleSourceDownload() {
    const button = $("reader-source-download-btn");
    const url = button?.dataset.url || "";
    if (!url) {
      return;
    }
    try {
      await downloadProtectedResource(fetchProtected, url, `${state.currentJobId || "result"}-source.pdf`);
    } catch (err) {
      setText("error-box", err.message);
    }
  }

  async function handleTranslatedDownload() {
    const button = $("reader-translated-download-btn");
    const url = button?.dataset.url || "";
    if (!url) {
      return;
    }
    try {
      const originalName = resolveOriginalPdfName(state);
      const preferredName = originalName ? `zh_${originalName}.pdf` : "";
      await downloadProtectedResource(
        fetchProtected,
        url,
        `${state.currentJobId || "result"}-translated.pdf`,
        preferredName,
      );
    } catch (err) {
      setText("error-box", err.message);
    }
  }

  async function handleMergedDownload() {
    const button = $("reader-merged-download-btn");
    const { sourcePdf, translatedPdf } = currentReaderArtifactUrls(state);
    if (!button || !sourcePdf || !translatedPdf) {
      return;
    }
    const previousMarkup = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "<span>生成中…</span>";
    try {
      const [sourceBytes, translatedBytes] = await Promise.all([
        fetchProtectedBytes(fetchProtected, sourcePdf, "原始 PDF"),
        fetchProtectedBytes(fetchProtected, translatedPdf, "译文 PDF"),
      ]);
      const mergedBytes = await buildMergedComparePdf(sourceBytes, translatedBytes);
      downloadBlob(new Blob([mergedBytes], { type: "application/pdf" }), `${state.currentJobId || "result"}-compare.pdf`);
    } catch (err) {
      setText("error-box", err.message);
    } finally {
      button.innerHTML = previousMarkup;
      syncToolbarActions();
    }
  }

  function resolveOpenArgs(input) {
    if (typeof input === "string") {
      return {
        url: buildReaderPageUrl(input),
        jobId: `${input || ""}`.trim(),
        disabled: false,
      };
    }
    if (input?.jobId || input?.url || typeof input?.disabled === "boolean") {
      const jobId = `${input?.jobId || ""}`.trim() || jobIdFromReaderUrl(input?.url);
      return {
        url: `${input?.url || buildReaderPageUrl(jobId)}`.trim(),
        jobId,
        disabled: !!input?.disabled,
      };
    }
    const link = input?.currentTarget;
    const url = `${link?.dataset?.url || ""}`.trim();
    let jobId = `${state.currentJobId || ""}`.trim();
    if (!jobId && url) {
      try {
        jobId = new URL(url, window.location.href).searchParams.get("job_id")?.trim() || "";
      } catch (_err) {
        jobId = "";
      }
    }
    return {
      url,
      jobId,
      disabled: link?.classList?.contains("disabled") || link?.getAttribute?.("aria-disabled") === "true",
    };
  }

  function open(input) {
    const { url, jobId, disabled } = resolveOpenArgs(input);
    if (input?.preventDefault) {
      input.preventDefault();
    }
    if (disabled || !url || !jobId) {
      return;
    }
    syncReaderRoute(jobId);
    const frame = $("reader-dialog-frame");
    if (frame) {
      setLoading(true);
      setLoadingProgress(8, "正在准备对照阅读…");
      const component = readerDialogComponent();
      if (component?.setFrameSource) {
        component.setFrameSource(url);
      } else {
        frame.src = url;
      }
    }
    syncToolbarActions();
    const component = readerDialogComponent();
    if (component?.open) {
      component.open();
    } else {
      $("reader-dialog")?.showModal();
    }
  }

  function close() {
    const component = readerDialogComponent();
    if (component?.close) {
      component.close();
    } else {
      $("reader-dialog")?.close();
    }
    setLoading(false);
    setLoadingProgress(0, "正在准备对照阅读…");
    setToolbarButtonState("reader-source-download-btn", false);
    setToolbarButtonState("reader-translated-download-btn", false);
    setToolbarButtonState("reader-merged-download-btn", false);
    syncReaderRoute("");
    const frame = $("reader-dialog-frame");
    if (frame) {
      if (component?.setFrameSource) {
        component.setFrameSource("about:blank");
      } else {
        frame.src = "about:blank";
      }
    }
  }

  function bindToolbarEvents() {
    $("reader-source-download-btn")?.addEventListener("click", handleSourceDownload);
    $("reader-merged-download-btn")?.addEventListener("click", handleMergedDownload);
    $("reader-translated-download-btn")?.addEventListener("click", handleTranslatedDownload);
  }

  function bindEvents() {
    bindToolbarEvents();
    $("reader-dialog-close-btn")?.addEventListener("click", close);
    $("reader-dialog-frame")?.addEventListener("load", () => {
      window.setTimeout(() => {
        const frame = $("reader-dialog-frame");
        if (frame?.src && frame.src !== "about:blank") {
          setLoading(false);
        }
      }, 1200);
    });
    window.addEventListener("message", (event) => {
      const frameWindow = $("reader-dialog-frame")?.contentWindow || null;
      if (!isTrustedWindowMessage(event, frameWindow)) {
        return;
      }
      const data = event.data;
      if (!data || data.type !== "retainpdf-reader-progress") {
        return;
      }
      setLoading(true);
      setLoadingProgress(data.percent, data.text);
      if (Number(data.percent) >= 100 && data.stage === "ready") {
        window.setTimeout(() => {
          setLoading(false);
        }, 180);
      }
    });
  }

  return {
    bindEvents,
    close,
    getRequestedJobIdFromLocation() {
      const url = new URL(window.location.href);
      const view = `${url.searchParams.get("view") || ""}`.trim();
      const jobId = `${url.searchParams.get("job_id") || ""}`.trim();
      return view === "reader" && jobId ? jobId : "";
    },
    open,
    syncToolbarActions,
  };
}
