class JobStatusCard extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.id = this.id || "status-section";
    this.classList.add("card", "status-card", "hidden");
    this.innerHTML = `
      <div class="status-head">
        <status-task-toolbar variant="head"></status-task-toolbar>
      </div>

      <div class="status-ring-shell">
        <div class="status-focus-card">
          <div id="status-stage-icon" class="status-stage-icon" aria-hidden="true"></div>
          <div id="status-ring-label" class="status-ring-label">等待中</div>
          <div id="status-ring-value" class="status-ring-value">准备中</div>
          <div id="status-ring-elapsed" class="status-ring-elapsed">0秒</div>
          <div class="status-progress-block">
            <div class="progress-track"><div id="job-progress-bar" class="progress-bar"></div></div>
            <div id="job-progress-text" class="status-progress-text">-</div>
          </div>
        </div>
        <div class="status-action-stack">
          <status-task-toolbar variant="downloads"></status-task-toolbar>
        </div>
      </div>

      <div class="hidden">
        <div id="job-id">-</div>
        <div id="job-status">idle</div>
        <div id="job-stage-detail">-</div>
        <div id="query-job-duration">-</div>
        <div id="job-finished-at">-</div>
        <a id="download-btn" class="button-link disabled" href="#" target="_blank" rel="noopener noreferrer">ZIP</a>
        <a id="markdown-raw-btn" class="button-link secondary disabled" href="#" target="_blank" rel="noopener noreferrer">Markdown</a>
        <a id="markdown-btn" class="button-link secondary disabled" href="#" target="_blank" rel="noopener noreferrer">JSON</a>
      </div>
    `;
  }

  setStagePresentation({ label = "等待中", value = "准备中", iconMarkup = "" } = {}) {
    const labelEl = this.querySelector("#status-ring-label");
    const valueEl = this.querySelector("#status-ring-value");
    const iconEl = this.querySelector("#status-stage-icon");
    if (labelEl) {
      labelEl.textContent = label;
    }
    if (valueEl) {
      valueEl.textContent = value;
    }
    if (iconEl) {
      iconEl.innerHTML = iconMarkup;
    }
  }

  syncPrimaryActions({ pdfReady = false, readerReady = false } = {}) {
    const pdfBtn = this.querySelector("#pdf-btn");
    const readerBtn = this.querySelector("#reader-btn");
    const actionRow = this.querySelector(".status-ring-downloads");
    if (pdfBtn) {
      pdfBtn.classList.toggle("hidden", !pdfReady);
    }
    if (readerBtn) {
      readerBtn.classList.toggle("hidden", !readerReady);
    }
    actionRow?.classList.remove("hidden");
  }

  setElapsed(value = "-") {
    const elapsed = this.querySelector("#status-ring-elapsed");
    if (elapsed) {
      elapsed.textContent = value;
    }
  }

  setProgress({ current = NaN, total = NaN, fallbackText = "-", percent = NaN } = {}) {
    const bar = this.querySelector("#job-progress-bar");
    const text = this.querySelector("#job-progress-text");
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
    const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : computedPercent));
    bar.style.width = `${safePercent}%`;
    text.textContent = `${current} / ${total} (${safePercent.toFixed(0)}%)`;
  }

  setCancelEnabled(enabled) {
    const button = this.querySelector("#cancel-btn");
    if (button) {
      button.disabled = !enabled;
    }
  }

  setBackHomeVisible(visible) {
    this.querySelector("#back-home-btn")?.classList.toggle("hidden", !visible);
  }

  renderSnapshot({
    label = "等待中",
    value = "准备中",
    iconMarkup = "",
    elapsed = "-",
    progressCurrent = NaN,
    progressTotal = NaN,
    progressFallbackText = "-",
    progressPercent = NaN,
    pdfReady = false,
    readerReady = false,
    cancelEnabled = false,
    backHomeVisible = false,
  } = {}) {
    this.setStagePresentation({ label, value, iconMarkup });
    this.setElapsed(elapsed);
    this.setProgress({
      current: progressCurrent,
      total: progressTotal,
      fallbackText: progressFallbackText,
      percent: progressPercent,
    });
    this.syncPrimaryActions({ pdfReady, readerReady });
    this.setCancelEnabled(cancelEnabled);
    this.setBackHomeVisible(backHomeVisible);
  }
}

if (!customElements.get("job-status-card")) {
  customElements.define("job-status-card", JobStatusCard);
}
