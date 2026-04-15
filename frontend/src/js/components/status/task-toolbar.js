class StatusTaskToolbar extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.classList.add("task-toolbar");
    const variant = this.getAttribute("variant") || "head";
    if (variant === "downloads") {
      this.classList.add("status-ring-downloads", "hidden");
      this.innerHTML = `
        <button id="status-detail-btn" type="button" class="task-toolbar-btn task-toolbar-btn-compact secondary" aria-label="任务详情" title="任务详情">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="7.9" r="1" fill="currentColor"/>
            <path d="M12 10.95v5.05" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
          </svg>
          <span>详情</span>
        </button>
        <a id="reader-btn" class="button-link secondary disabled task-toolbar-btn hidden" href="#" aria-label="对照阅读" title="对照阅读" aria-disabled="true">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5.1 7.95c0-.97.78-1.75 1.75-1.75H11v11.95H6.85A1.75 1.75 0 0 0 5.1 19.9V7.95Zm13.8 0c0-.97-.78-1.75-1.75-1.75H13v11.95h4.15c.97 0 1.75.78 1.75 1.75V7.95Z" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/>
            <path d="M12 6.45v12.9" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/>
          </svg>
          <span>对照阅读</span>
        </a>
        <a id="pdf-btn" class="button-link disabled task-toolbar-btn task-toolbar-btn-primary hidden" href="#" target="_blank" rel="noopener noreferrer" aria-label="下载 PDF" title="下载 PDF">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 6v8.1" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
            <path d="M9.15 11.35 12 14.2l2.85-2.85" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7.1 17.85h9.8" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
          </svg>
          <span>下载 PDF</span>
        </a>
      `;
      return;
    }

    this.classList.add("status-head-actions");
    this.innerHTML = `
      <button id="cancel-btn" type="button" class="task-toolbar-btn secondary" aria-label="取消任务" title="取消任务" disabled>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8.4 8.4l7.2 7.2M15.6 8.4l-7.2 7.2" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
        </svg>
        <span>取消</span>
      </button>
      <button id="stop-btn" type="button" class="task-toolbar-btn secondary" aria-label="停止轮询" title="停止轮询">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="7.7" y="7.7" width="8.6" height="8.6" rx="2.2" fill="currentColor"/>
        </svg>
        <span>停止</span>
      </button>
      <button id="back-home-btn" type="button" class="task-toolbar-btn secondary hidden" aria-label="返回主页面" title="返回主页面">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5.4 11.4 12 6.05l6.6 5.35" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8.7 10.8v6.95h6.6V10.8" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>主页</span>
      </button>
    `;
  }
}

if (!customElements.get("status-task-toolbar")) {
  customElements.define("status-task-toolbar", StatusTaskToolbar);
}
