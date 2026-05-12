import { $ } from "../../dom.js";

function readerDialogComponent() {
  return document.querySelector("reader-dialog");
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

export function animateReaderProgressValue(progressState, nextValue) {
  const component = readerDialogComponent();
  const barEl = $("reader-dialog-loading-bar");
  const target = Math.max(0, Math.min(100, Number(nextValue) || 0));
  const from = Number(progressState.value) || 0;

  if (!barEl && !component?.setLoadingProgress) {
    progressState.value = target;
    progressState.target = target;
    return;
  }

  const applyWidth = (value) => {
    if (barEl) {
      barEl.style.width = `${value}%`;
    }
    if (component?.setLoadingProgress) {
      component.setLoadingProgress({ widthPercent: value });
    }
  };

  if (Math.abs(from - target) < 0.1) {
    progressState.value = target;
    progressState.target = target;
    applyWidth(target);
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
    const value = from + ((target - from) * easeOutCubic(t));
    progressState.value = value;
    applyWidth(value);
    if (t < 1) {
      progressState.rafId = requestAnimationFrame(tick);
      return;
    }
    progressState.value = target;
    progressState.rafId = 0;
    applyWidth(target);
  };

  progressState.rafId = requestAnimationFrame(tick);
}

export function setReaderToolbarButtonState(id, enabled, url = "") {
  const component = readerDialogComponent();
  if (component?.setToolbarButtonState) {
    component.setToolbarButtonState(id, { enabled, url });
    return;
  }
  const button = $(id);
  if (!button) {
    return;
  }
  button.disabled = !enabled;
  button.dataset.url = enabled ? url : "";
}

export function getReaderToolbarButtonUrl(id) {
  return `${$(id)?.dataset?.url || ""}`.trim();
}

export function setReaderLoadingVisible(loading) {
  const component = readerDialogComponent();
  if (component?.setLoadingVisible) {
    component.setLoadingVisible(loading);
    return;
  }
  $("reader-dialog-loading")?.classList.toggle("hidden", !loading);
}

export function setReaderLoadingProgress(progressState, percent = 0, text = "正在准备对照阅读…") {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const component = readerDialogComponent();
  const textEl = $("reader-dialog-loading-text");
  if (textEl) {
    textEl.textContent = text;
  }
  if (component?.setLoadingProgress) {
    component.setLoadingProgress({ text, percent: safePercent });
  }
  animateReaderProgressValue(progressState, safePercent);
}

export function setReaderFrameSource(url = "about:blank") {
  const component = readerDialogComponent();
  if (component?.setFrameSource) {
    component.setFrameSource(url);
    return;
  }
  const frame = $("reader-dialog-frame");
  if (frame) {
    frame.src = url;
  }
}

export function openReaderDialog() {
  const component = readerDialogComponent();
  if (component?.open) {
    component.open();
    return;
  }
  $("reader-dialog")?.showModal();
}

export function closeReaderDialog() {
  const component = readerDialogComponent();
  if (component?.close) {
    component.close();
    return;
  }
  $("reader-dialog")?.close();
}

export function getReaderFrameWindow() {
  const component = readerDialogComponent();
  if (component?.getFrameWindow) {
    return component.getFrameWindow();
  }
  return $("reader-dialog-frame")?.contentWindow || null;
}

export function hasLoadedReaderFrame() {
  const component = readerDialogComponent();
  if (component?.hasLoadedFrame) {
    return component.hasLoadedFrame();
  }
  const frame = $("reader-dialog-frame");
  return Boolean(frame?.src && frame.src !== "about:blank");
}

export function getReaderLinkOpenState(input) {
  const link = input?.currentTarget;
  return {
    url: `${link?.dataset?.url || ""}`.trim(),
    disabled: link?.classList?.contains("disabled") || link?.getAttribute?.("aria-disabled") === "true",
  };
}

export function setReaderButtonBusy(id, busy, label = "生成中…") {
  const button = $(id);
  if (!button) {
    return "";
  }
  const previousMarkup = button.innerHTML;
  if (busy) {
    button.disabled = true;
    button.innerHTML = `<span>${label}</span>`;
  }
  return previousMarkup;
}

export function restoreReaderButton(id, markup) {
  const button = $(id);
  if (button && typeof markup === "string") {
    button.innerHTML = markup;
  }
}

export function downloadReaderBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function bindReaderDialogEvents({
  onClose,
  onFrameLoad,
  onSourceDownload,
  onMergedDownload,
  onTranslatedDownload,
} = {}) {
  const component = readerDialogComponent();
  if (component?.bindEvents) {
    component.bindEvents({
      onClose,
      onFrameLoad,
      onSourceDownload,
      onMergedDownload,
      onTranslatedDownload,
    });
    return;
  }
  $("reader-source-download-btn")?.addEventListener("click", () => onSourceDownload?.());
  $("reader-merged-download-btn")?.addEventListener("click", () => onMergedDownload?.());
  $("reader-translated-download-btn")?.addEventListener("click", () => onTranslatedDownload?.());
  $("reader-dialog-close-btn")?.addEventListener("click", () => onClose?.());
  $("reader-dialog-frame")?.addEventListener("load", () => onFrameLoad?.());
}
