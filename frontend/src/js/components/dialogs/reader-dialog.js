class ReaderDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="reader-dialog" class="desktop-dialog reader-dialog">
        <div class="reader-dialog-shell">
          <div class="reader-dialog-head">
            <div class="reader-dialog-toolbar">
              <button id="reader-source-download-btn" type="button" class="reader-dialog-toolbar-btn secondary" disabled>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 6.25v7.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <path d="M9.35 11.8 12 14.45l2.65-2.65" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7.25 17.35h9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                <span>原始 PDF</span>
              </button>
              <button id="reader-merged-download-btn" type="button" class="reader-dialog-toolbar-btn secondary" disabled>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4.75" y="6.25" width="5.75" height="11.5" rx="1.6" stroke="currentColor" stroke-width="1.45"/>
                  <rect x="13.5" y="6.25" width="5.75" height="11.5" rx="1.6" stroke="currentColor" stroke-width="1.45"/>
                  <path d="M12 5.3v13.4" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>
                </svg>
                <span>对照 PDF</span>
              </button>
              <button id="reader-translated-download-btn" type="button" class="reader-dialog-toolbar-btn secondary" disabled>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 6.25v7.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <path d="M9.35 11.8 12 14.45l2.65-2.65" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7.25 17.35h9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <path d="M7.4 8.1h2.3" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>
                  <path d="M14.3 8.1h2.3" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>
                </svg>
                <span>译文 PDF</span>
              </button>
            </div>
            <button id="reader-dialog-close-btn" type="button" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div id="reader-dialog-loading" class="reader-dialog-loading hidden" aria-live="polite">
            <div class="reader-dialog-loading-card">
              <div id="reader-dialog-loading-text" class="reader-dialog-loading-text">正在准备对照阅读…</div>
              <div class="reader-dialog-loading-track">
                <span id="reader-dialog-loading-bar" class="reader-dialog-loading-bar"></span>
              </div>
            </div>
          </div>
          <iframe id="reader-dialog-frame" class="reader-dialog-frame" title="对照阅读"></iframe>
        </div>
      </dialog>
    `;
  }

  dialogElement() {
    return this.querySelector("#reader-dialog");
  }

  frameElement() {
    return this.querySelector("#reader-dialog-frame");
  }

  setLoadingVisible(loading) {
    this.querySelector("#reader-dialog-loading")?.classList.toggle("hidden", !loading);
  }

  setLoadingProgress({ text = "正在准备对照阅读…", percent = 0, widthPercent = null } = {}) {
    const textEl = this.querySelector("#reader-dialog-loading-text");
    const barEl = this.querySelector("#reader-dialog-loading-bar");
    if (textEl) {
      textEl.textContent = text;
    }
    if (barEl) {
      const value = widthPercent ?? percent;
      barEl.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
    }
  }

  setToolbarButtonState(id, { enabled = false, url = "" } = {}) {
    const button = this.querySelector(`#${id}`);
    if (!button) {
      return;
    }
    button.disabled = !enabled;
    button.dataset.url = enabled ? url : "";
  }

  setFrameSource(url = "about:blank") {
    const frame = this.frameElement();
    if (frame) {
      frame.src = url;
    }
  }

  open() {
    this.dialogElement()?.showModal();
  }

  close() {
    this.dialogElement()?.close();
  }
}

if (!customElements.get("reader-dialog")) {
  customElements.define("reader-dialog", ReaderDialog);
}
