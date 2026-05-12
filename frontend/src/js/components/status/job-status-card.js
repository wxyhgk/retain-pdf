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
          <div id="status-stage-flow" class="status-stage-flow" aria-label="任务流程">
            <span class="status-stage-step" data-stage-key="ocr">OCR</span>
            <span class="status-stage-step" data-stage-key="translate">翻译</span>
            <span class="status-stage-step" data-stage-key="render">渲染</span>
            <span class="status-stage-step" data-stage-key="done">完成</span>
          </div>
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

  setStagePresentation({ label = "等待中", value = "准备中", stageKey = "" } = {}) {
    const labelEl = this.querySelector("#status-ring-label");
    const valueEl = this.querySelector("#status-ring-value");
    this.setStageFlow(stageKey);
    if (labelEl) {
      labelEl.textContent = label;
    }
    if (valueEl) {
      valueEl.textContent = value;
    }
  }

  setStageFlow(stageKey = "") {
    const flowOrder = ["ocr", "translate", "render", "done"];
    const normalized = `${stageKey || ""}`.trim();
    const activeIndex = flowOrder.indexOf(normalized);
    this.querySelectorAll(".status-stage-step").forEach((step) => {
      const stepIndex = flowOrder.indexOf(step.dataset.stageKey || "");
      const isDone = activeIndex >= 0 && stepIndex >= 0 && stepIndex < activeIndex;
      const isActive = activeIndex >= 0 && stepIndex === activeIndex;
      step.classList.toggle("is-done", isDone);
      step.classList.toggle("is-active", isActive);
    });
  }

  syncPrimaryActions({ pdfReady = false, readerReady = false, sourceReady = false } = {}) {
    const pdfBtn = this.querySelector("#pdf-btn");
    const sourceBtn = this.querySelector("#source-pdf-btn");
    const readerBtn = this.querySelector("#reader-btn");
    const actionRow = this.querySelector(".status-ring-downloads");
    if (pdfBtn) {
      pdfBtn.classList.toggle("hidden", !pdfReady);
    }
    if (sourceBtn) {
      sourceBtn.classList.toggle("hidden", !sourceReady);
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

  setProgress({ current = NaN, total = NaN, fallbackText = "-", percent = NaN, progressText = "" } = {}) {
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
    text.textContent = progressText || `${current} / ${total} (${safePercent.toFixed(0)}%)`;
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
    stageKey = "",
    elapsed = "-",
    progressCurrent = NaN,
    progressTotal = NaN,
    progressFallbackText = "-",
    progressPercent = NaN,
    progressText = "",
    pdfReady = false,
    sourceReady = false,
    readerReady = false,
    cancelEnabled = false,
    backHomeVisible = false,
  } = {}) {
    this.setStagePresentation({ label, value, stageKey });
    this.setElapsed(elapsed);
    this.setProgress({
      current: progressCurrent,
      total: progressTotal,
      fallbackText: progressFallbackText,
      percent: progressPercent,
      progressText,
    });
    this.syncPrimaryActions({ pdfReady, readerReady, sourceReady });
    this.setCancelEnabled(cancelEnabled);
    this.setBackHomeVisible(backHomeVisible);
  }
}

if (!customElements.get("job-status-card")) {
  customElements.define("job-status-card", JobStatusCard);
}
