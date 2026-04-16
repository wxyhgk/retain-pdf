class PageRangeDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="page-range-dialog" class="desktop-dialog page-range-dialog">
        <form method="dialog" class="desktop-shell">
          <div class="desktop-head">
            <h2 id="page-range-title">分页翻译</h2>
            <button id="page-range-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div class="desktop-body">
            <p id="page-range-limit-text" class="muted">按页码范围限制本次翻译，页码从 1 开始。</p>
            <div class="grid two">
              <label>
                <span>起始页</span>
                <input id="page-range-start" type="number" min="1" step="1" inputmode="numeric" autocomplete="off" placeholder="例如 1" />
              </label>
              <label>
                <span>结束页</span>
                <input id="page-range-end" type="number" min="1" step="1" inputmode="numeric" autocomplete="off" placeholder="例如 15" />
              </label>
            </div>
            <div class="actions">
              <button id="page-range-clear-btn" type="button" class="secondary">清空</button>
              <button id="page-range-apply-btn" type="button">应用</button>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }
}

if (!customElements.get("page-range-dialog")) {
  customElements.define("page-range-dialog", PageRangeDialog);
}
