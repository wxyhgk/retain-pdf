export function jobStatusCardTemplate({
  translationAnimationPath,
  ocrAnimationPath,
  uploadAnimationPath,
  downloadAnimationPath,
  renderAnimationPath,
} = {}) {
  return `
    <div class="status-head">
      <button id="cancel-btn" type="button" class="task-toolbar-btn secondary status-head-btn status-head-cancel" aria-label="取消任务" title="取消任务" disabled>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8.4 8.4l7.2 7.2M15.6 8.4l-7.2 7.2" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
        </svg>
        <span>取消</span>
      </button>
      <div id="status-ring-elapsed" class="status-ring-elapsed">0秒</div>
      <button id="back-home-btn" type="button" class="task-toolbar-btn secondary status-head-btn status-head-home hidden" aria-label="返回主页面" title="返回主页面">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5.4 11.4 12 6.05l6.6 5.35" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8.7 10.8v6.95h6.6V10.8" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>主页</span>
      </button>
    </div>

    <div class="status-ring-shell">
      <div class="status-focus-card">
        <div class="status-focus-top">
          <div id="status-stage-flow" class="status-stage-flow" role="tablist" aria-label="任务流程">
            <button type="button" class="status-stage-step" data-stage-key="ocr" role="tab">OCR</button>
            <button type="button" class="status-stage-step" data-stage-key="translate" role="tab">翻译</button>
            <button type="button" class="status-stage-step" data-stage-key="render" role="tab">渲染</button>
            <button type="button" class="status-stage-step" data-stage-key="done" role="tab">完成</button>
          </div>
        </div>
        <div class="status-focus-body">
          <div id="status-ring-label" class="status-ring-label">等待中</div>
          <div id="status-ring-value" class="status-ring-value hidden">准备中</div>
          <div id="status-stage-detail" class="status-stage-detail hidden">-</div>
          <div id="status-stage-animation" class="status-stage-animation hidden" aria-label="任务阶段动画">
            <div id="status-stage-lottie" class="status-stage-lottie"></div>
          </div>
          <div class="status-substage-flow hidden" aria-label="翻译子阶段">
            <span class="status-substage-step" data-substage-key="translation_batches">翻译批次</span>
            <span class="status-substage-step" data-substage-key="continuation_review">跨栏/跨页</span>
            <span class="status-substage-step" data-substage-key="page_policies">页面策略</span>
            <span class="status-substage-step" data-substage-key="garbled">乱码修复</span>
          </div>
          <div class="status-progress-block">
            <div class="progress-track"><div id="job-progress-bar" class="progress-bar"></div></div>
            <div id="job-progress-text" class="status-progress-text">-</div>
          </div>
        </div>
      </div>
      <div class="status-card-footer">
        <button id="status-detail-btn" type="button" class="task-toolbar-btn task-toolbar-btn-compact secondary" aria-label="任务详情" title="任务详情">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="7.9" r="1" fill="currentColor"/>
            <path d="M12 10.95v5.05" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
          </svg>
          <span>详情</span>
        </button>
        <div class="status-result-actions hidden">
          <a id="reader-btn" class="button-link secondary disabled task-toolbar-btn task-toolbar-btn-result hidden" href="#" aria-label="对照阅读" title="对照阅读" aria-disabled="true">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5.1 7.95c0-.97.78-1.75 1.75-1.75H11v11.95H6.85A1.75 1.75 0 0 0 5.1 19.9V7.95Zm13.8 0c0-.97-.78-1.75-1.75-1.75H13v11.95h4.15c.97 0 1.75.78 1.75 1.75V7.95Z" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/>
              <path d="M12 6.45v12.9" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/>
            </svg>
            <span>对照阅读</span>
          </a>
          <a id="pdf-btn" class="button-link secondary disabled task-toolbar-btn task-toolbar-btn-result hidden" href="#" target="_blank" rel="noopener noreferrer" aria-label="下载 PDF" title="下载 PDF">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 6v8.1" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
              <path d="M9.15 11.35 12 14.2l2.85-2.85" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7.1 17.85h9.8" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
            </svg>
            <span>下载 PDF</span>
          </a>
        </div>
      </div>
    </div>

    <div class="hidden">
      <div id="job-id">-</div>
      <div id="job-status">idle</div>
      <div id="job-stage-detail">-</div>
      <div id="query-job-duration">-</div>
      <div id="job-finished-at">-</div>
      <span id="status-translation-animation-src">${translationAnimationPath || ""}</span>
      <span id="status-ocr-animation-src">${ocrAnimationPath || ""}</span>
      <span id="status-upload-animation-src">${uploadAnimationPath || ""}</span>
      <span id="status-download-animation-src">${downloadAnimationPath || ""}</span>
      <span id="status-render-animation-src">${renderAnimationPath || ""}</span>
      <a id="download-btn" class="button-link disabled" href="#" target="_blank" rel="noopener noreferrer">ZIP</a>
      <a id="markdown-raw-btn" class="button-link secondary disabled" href="#" target="_blank" rel="noopener noreferrer">Markdown</a>
      <a id="markdown-btn" class="button-link secondary disabled" href="#" target="_blank" rel="noopener noreferrer">JSON</a>
    </div>
  `;
}
