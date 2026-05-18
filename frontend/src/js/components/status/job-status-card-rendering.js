export function syncPrimaryActions(host, { pdfReady = false, readerReady = false } = {}) {
  const pdfBtn = host.querySelector("#pdf-btn");
  const readerBtn = host.querySelector("#reader-btn");
  const actionRow = host.querySelector(".status-result-actions");
  if (pdfBtn) {
    pdfBtn.classList.toggle("hidden", !pdfReady);
  }
  if (readerBtn) {
    readerBtn.classList.toggle("hidden", !readerReady);
  }
  actionRow?.classList.toggle("hidden", !(pdfReady || readerReady));
}

export function setElapsed(host, value = "-") {
  const elapsed = host.querySelector("#status-ring-elapsed");
  if (elapsed) {
    elapsed.textContent = value;
  }
}

export function setProgress(host, {
  current = NaN,
  total = NaN,
  fallbackText = "-",
  percent = NaN,
  progressText = "",
  stageKey = "",
  forceVisible = null,
  indeterminate = false,
} = {}) {
  const normalizedStageKey = `${stageKey || ""}`.trim();
  const shouldShowProgress = forceVisible ?? ["ocr", "translate", "render"].includes(normalizedStageKey);
  const block = host.querySelector(".status-progress-block");
  const bar = host.querySelector("#job-progress-bar");
  const text = host.querySelector("#job-progress-text");
  if (!bar || !text) {
    return;
  }
  block?.classList.toggle("hidden", !shouldShowProgress);
  if (!shouldShowProgress) {
    bar.style.width = "0%";
    bar.classList.remove("is-indeterminate");
    text.textContent = "";
    return;
  }
  const numericCurrent = Number(current);
  const numericTotal = Number(total);
  const numericPercent = Number(percent);
  bar.classList.toggle("is-indeterminate", Boolean(indeterminate));
  if (indeterminate) {
    bar.style.width = "42%";
    text.textContent = progressText || fallbackText;
    return;
  }
  const hasNumbers = Number.isFinite(numericCurrent) && Number.isFinite(numericTotal) && numericTotal > 0;
  if (!hasNumbers) {
    bar.style.width = "0%";
    text.textContent = fallbackText;
    return;
  }
  const computedPercent = (numericCurrent / numericTotal) * 100;
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(numericPercent) ? numericPercent : computedPercent));
  bar.style.width = `${safePercent}%`;
  text.textContent = progressText || `${numericCurrent} / ${numericTotal} (${safePercent.toFixed(0)}%)`;
}

export function setCancelEnabled(host, enabled) {
  const button = host.querySelector("#cancel-btn");
  if (button) {
    button.disabled = !enabled;
  }
}

export function setBackHomeVisible(host, visible) {
  host.querySelector("#back-home-btn")?.classList.toggle("hidden", !visible);
}
