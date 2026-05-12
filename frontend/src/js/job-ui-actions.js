import { buildFrontendPageUrl } from "./config.js";
import { DEFAULT_FILE_LABEL } from "./constants.js";
import { $ } from "./dom.js";
import {
  hasReadyManifestArtifact,
  resolveManifestArtifactUrl,
} from "./job-artifacts.js";
import { resolveJobActions } from "./job.js";
import { state } from "./state.js";

export function setActionLink(id, url, enabled) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.href = enabled && url ? url : "#";
  el.dataset.url = enabled && url ? url : "";
  el.classList.toggle("disabled", !enabled);
  el.setAttribute("aria-disabled", enabled ? "false" : "true");
}

export function buildReaderPageUrl(jobId) {
  const normalizedJobId = `${jobId || ""}`.trim();
  if (!normalizedJobId) {
    return "";
  }
  return buildFrontendPageUrl("./reader.html", {
    job_id: normalizedJobId,
  });
}

export function isReaderActionEnabled(job, manifestPayload = null) {
  const actions = resolveJobActions(job);
  return Boolean(
    job?.job_id
    && hasReadyManifestArtifact(manifestPayload, "source_pdf")
    && (hasReadyManifestArtifact(manifestPayload, "pdf")
      || hasReadyManifestArtifact(manifestPayload, "translated_pdf")
      || hasReadyManifestArtifact(manifestPayload, "result_pdf")
      || actions.pdfEnabled),
  );
}

export function updateActionButtons(job, manifestPayload = null) {
  const actions = resolveJobActions(job);
  const sourcePdfUrl = resolveManifestArtifactUrl(manifestPayload, "source_pdf");
  setActionLink("download-btn", actions.bundle, actions.bundleEnabled && !!actions.bundle);
  const markdownBundleUrl = resolveManifestArtifactUrl(manifestPayload, "markdown_bundle_zip", {
    includeJobDir: true,
  });
  setActionLink("markdown-bundle-btn", markdownBundleUrl, !!markdownBundleUrl);
  setActionLink("source-pdf-btn", sourcePdfUrl, !!sourcePdfUrl);
  setActionLink("pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);
  setActionLink("markdown-btn", actions.markdownJson, actions.markdownJsonEnabled && !!actions.markdownJson);
  setActionLink("markdown-raw-btn", actions.markdownRaw, actions.markdownRawEnabled && !!actions.markdownRaw);
  const readerEnabled = isReaderActionEnabled(job, manifestPayload);
  setActionLink("reader-btn", buildReaderPageUrl(job?.job_id), readerEnabled);
  setActionLink("compare-reader-btn", buildReaderPageUrl(job?.job_id), readerEnabled);
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setCancelEnabled && !statusCard?.renderSnapshot) {
    statusCard.setCancelEnabled(actions.cancelEnabled && !!actions.cancel);
  } else {
    $("cancel-btn").disabled = !(actions.cancelEnabled && !!actions.cancel);
  }
}

export function setLinearProgress(barId, textId, current, total, fallbackText = "-", percentOverride = null) {
  if (barId === "job-progress-bar" && textId === "job-progress-text") {
    const statusCard = document.querySelector("job-status-card");
    if (statusCard?.setProgress && !statusCard?.renderSnapshot) {
      statusCard.setProgress({
        current,
        total,
        fallbackText,
        percent: percentOverride,
      });
      return;
    }
  }
  const bar = $(barId);
  const text = $(textId);
  const hasNumbers = Number.isFinite(current) && Number.isFinite(total) && total > 0;
  if (!hasNumbers) {
    bar.style.width = "0%";
    text.textContent = fallbackText;
    return;
  }
  const computedPercent = (current / total) * 100;
  const percent = Math.max(0, Math.min(100, Number.isFinite(percentOverride) ? percentOverride : computedPercent));
  bar.style.width = `${percent}%`;
  text.textContent = `${current} / ${total} (${percent.toFixed(0)}%)`;
}

export function setUploadProgress(loaded, total) {
  const panel = $("upload-progress-panel");
  panel.classList.remove("hidden");
  const tile = $("file")?.closest(".upload-tile");
  tile?.classList.add("is-uploading");
  tile?.classList.remove("is-ready");
  $("upload-action-slot")?.classList.add("hidden");
  const hasNumbers = Number.isFinite(loaded) && Number.isFinite(total) && total > 0;
  const fill = $("upload-fill");
  if (hasNumbers) {
    const percent = Math.max(0, Math.min(100, (loaded / total) * 100));
    if (fill) {
      fill.style.width = `${percent}%`;
    }
    $("upload-progress-text").textContent = `上传中 ${percent.toFixed(0)}%`;
    return;
  }
  if (fill) {
    fill.style.width = "18%";
  }
  $("upload-progress-text").textContent = "上传中";
}

export function resetUploadProgress() {
  $("upload-progress-panel").classList.add("hidden");
  const tile = $("file")?.closest(".upload-tile");
  tile?.classList.remove("is-uploading");
  const fill = $("upload-fill");
  if (fill) {
    fill.style.width = "0%";
  }
  $("upload-progress-text").textContent = "上传中";
}

export function clearFileInputValue() {
  const input = $("file");
  if (input) {
    input.value = "";
  }
}

export function resetUploadedFile() {
  state.uploadId = "";
  state.uploadedFileName = "";
  state.uploadedPageCount = 0;
  state.uploadedBytes = 0;
  state.currentJobStartedAt = "";
  state.currentJobFinishedAt = "";
  $("file").value = "";
  $("submit-btn").disabled = true;
  $("upload-action-slot")?.classList.add("hidden");
  $("file")?.closest(".upload-tile")?.classList.remove("is-ready");
  $("upload-status").textContent = "未上传文件";
  $("upload-status")?.classList.add("hidden");
  $("file-label").textContent = DEFAULT_FILE_LABEL;
  $("file-label").title = "";
}

export function prepareFilePicker() {
  clearFileInputValue();
}
