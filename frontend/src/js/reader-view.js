import { $ } from "./dom.js";

export function setReaderBootLoading(loading) {
  const loadingEl = $("reader-boot-loading");
  if (!loadingEl) {
    return;
  }
  loadingEl.classList.toggle("hidden", !loading);
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

export function animateReaderProgressValue(progressBarState, nextValue) {
  const element = $("reader-boot-loading-bar");
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
    const value = from + ((target - from) * easeOutCubic(t));
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

export function setReaderBootProgressText(text) {
  const el = $("reader-boot-loading-text");
  if (el) {
    el.textContent = text;
  }
}

export function setPageIndicator(currentPage, totalPages) {
  const indicator = $("reader-page-indicator");
  if (!indicator || !totalPages) {
    indicator?.classList.add("hidden");
    return;
  }
  indicator.textContent = `第 ${currentPage} / ${totalPages} 页`;
  indicator.classList.remove("hidden");
}

export function showReaderPaneEmpty(key, emptyId) {
  $(`${key}-wrap`)?.classList.add("hidden");
  $(emptyId)?.classList.remove("hidden");
}

export function showReaderPaneReady(key, emptyId) {
  $(`${key}-wrap`)?.classList.remove("hidden");
  $(emptyId)?.classList.add("hidden");
}

export function showBothReaderEmpty() {
  $("reader-pdf-empty")?.classList.remove("hidden");
  $("reader-translation-empty")?.classList.remove("hidden");
}
