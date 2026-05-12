import { DEFAULT_FILE_LABEL } from "./constants.js";
import { $ } from "./dom.js";

export function setActionLinkView(id, url, enabled) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.href = enabled && url ? url : "#";
  el.dataset.url = enabled && url ? url : "";
  el.classList.toggle("disabled", !enabled);
  el.setAttribute("aria-disabled", enabled ? "false" : "true");
}

export function setStatusCardCancelEnabled(enabled) {
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setCancelEnabled && !statusCard?.renderSnapshot) {
    statusCard.setCancelEnabled(enabled);
    return;
  }
  const button = $("cancel-btn");
  if (button) {
    button.disabled = !enabled;
  }
}

export function setLinearProgressView(barId, textId, current, total, fallbackText = "-", percentOverride = null) {
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
  if (!bar || !text) {
    return;
  }
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

export function setUploadProgressView(loaded, total) {
  const panel = $("upload-progress-panel");
  panel?.classList.remove("hidden");
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
    const text = $("upload-progress-text");
    if (text) {
      text.textContent = `上传中 ${percent.toFixed(0)}%`;
    }
    return;
  }
  if (fill) {
    fill.style.width = "18%";
  }
  const text = $("upload-progress-text");
  if (text) {
    text.textContent = "上传中";
  }
}

export function resetUploadProgressView() {
  $("upload-progress-panel")?.classList.add("hidden");
  const tile = $("file")?.closest(".upload-tile");
  tile?.classList.remove("is-uploading");
  const fill = $("upload-fill");
  if (fill) {
    fill.style.width = "0%";
  }
  const text = $("upload-progress-text");
  if (text) {
    text.textContent = "上传中";
  }
}

export function clearFileInputValueView() {
  const input = $("file");
  if (input) {
    input.value = "";
  }
}

export function resetUploadedFileView() {
  clearFileInputValueView();
  const submitButton = $("submit-btn");
  if (submitButton) {
    submitButton.disabled = true;
  }
  $("upload-action-slot")?.classList.add("hidden");
  $("file")?.closest(".upload-tile")?.classList.remove("is-ready");
  const uploadStatus = $("upload-status");
  if (uploadStatus) {
    uploadStatus.textContent = "未上传文件";
    uploadStatus.classList.add("hidden");
  }
  const fileLabel = $("file-label");
  if (fileLabel) {
    fileLabel.textContent = DEFAULT_FILE_LABEL;
    fileLabel.title = "";
  }
}
