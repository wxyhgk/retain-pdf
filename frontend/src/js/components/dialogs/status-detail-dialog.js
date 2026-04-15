class StatusDetailDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="status-detail-dialog" class="desktop-dialog status-detail-dialog">
        <form method="dialog" class="desktop-shell">
          <div class="desktop-head">
            <div class="status-detail-headline">
              <span id="status-detail-head-icon" class="status-detail-head-icon" aria-hidden="true"></span>
              <div class="status-detail-head-copy">
                <div class="status-detail-head-top">
                  <h2>任务详情</h2>
                  <p class="status-detail-job-meta">Job ID <span id="status-detail-job-id" class="status-detail-job-id mono">-</span></p>
                </div>
                <p id="status-detail-head-note" class="status-panel-note">查看任务概览、失败原因与事件流</p>
              </div>
            </div>
            <button id="status-detail-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div class="desktop-body status-detail-body">
            <div class="detail-tabs" role="tablist" aria-label="任务详情">
              <button id="detail-tab-overview" type="button" class="detail-tab is-active" data-tab="overview" role="tab" aria-selected="true">概览</button>
              <button id="detail-tab-failure" type="button" class="detail-tab" data-tab="failure" role="tab" aria-selected="false">失败</button>
              <button id="detail-tab-events" type="button" class="detail-tab" data-tab="events" role="tab" aria-selected="false">事件</button>
            </div>

            <div class="detail-tab-panels">
              <section id="detail-panel-overview" class="detail-tab-panel is-active" data-panel="overview" role="tabpanel">
                <div class="detail-download-row">
                  <a id="markdown-bundle-btn" class="button-link secondary disabled" href="#" target="_blank" rel="noopener noreferrer">下载 Markdown ZIP</a>
                </div>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="label">当前阶段</span>
                    <span id="runtime-current-stage" class="info-value">-</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">当前阶段耗时</span>
                    <span id="runtime-stage-elapsed" class="info-value">-</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">累计耗时</span>
                    <span id="runtime-total-elapsed" class="info-value">-</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">重试次数</span>
                    <span id="runtime-retry-count" class="info-value">0</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">最近切换</span>
                    <span id="runtime-last-transition" class="info-value">-</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">终态原因</span>
                    <span id="runtime-terminal-reason" class="info-value">-</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">输入协议</span>
                    <span id="runtime-input-protocol" class="info-value">-</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Stage Schema</span>
                    <span id="runtime-stage-spec-version" class="info-value">-</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">公式模式</span>
                    <span id="runtime-math-mode" class="info-value">-</span>
                  </div>
                </div>
                <div class="status-panel detail-stage-panel">
                  <div class="status-panel-head">
                    <h3>过程时间线</h3>
                  </div>
                  <div id="overview-stage-empty" class="events-empty">暂无阶段记录</div>
                  <div id="overview-stage-list" class="stage-history-list hidden"></div>
                </div>
              </section>

              <section id="detail-panel-failure" class="detail-tab-panel" data-panel="failure" role="tabpanel" hidden>
                <div class="status-panel">
                  <div class="status-panel-head">
                    <h3>失败诊断</h3>
                    <span class="status-panel-note">结构化失败摘要与排查建议</span>
                  </div>
                  <div class="failure-hero-card">
                    <span class="label">失败摘要</span>
                    <span id="failure-summary" class="info-value">-</span>
                  </div>
                  <div class="info-list detail-info-list">
                    <div class="info-row">
                      <span class="label">分类</span>
                      <span id="failure-category" class="info-value">-</span>
                    </div>
                    <div class="info-row">
                      <span class="label">阶段</span>
                      <span id="failure-stage" class="info-value">-</span>
                    </div>
                    <div class="info-row">
                      <span class="label">根因</span>
                      <span id="failure-root-cause" class="info-value">-</span>
                    </div>
                    <div class="info-row">
                      <span class="label">建议</span>
                      <span id="failure-suggestion" class="info-value">-</span>
                    </div>
                    <div class="info-row">
                      <span class="label">最近日志</span>
                      <span id="failure-last-log-line" class="info-value">-</span>
                    </div>
                    <div class="info-row">
                      <span class="label">可重试</span>
                      <span id="failure-retryable" class="info-value">-</span>
                    </div>
                  </div>
                </div>
              </section>

              <section id="detail-panel-events" class="detail-tab-panel" data-panel="events" role="tabpanel" hidden>
                <div class="status-panel">
                  <div class="status-panel-head">
                    <h3>事件流</h3>
                    <span id="events-status" class="status-panel-note">全部事件</span>
                  </div>
                  <p class="events-lead">按时间倒序展示最近事件，适合定位任务卡在哪个阶段以及最后一次失败前发生了什么。</p>
                  <div id="events-empty" class="events-empty">暂无事件</div>
                  <div id="events-list" class="events-list hidden"></div>
                </div>
              </section>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }

  dialogElement() {
    return this.querySelector("#status-detail-dialog");
  }

  activateTab(name = "overview") {
    const tabs = this.querySelectorAll(".detail-tab");
    const panels = this.querySelectorAll(".detail-tab-panel");
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  open(tabName = "overview") {
    this.activateTab(tabName);
    this.dialogElement()?.showModal();
  }

  close() {
    this.dialogElement()?.close();
  }

  setHeadline({ iconMarkup = "", jobId = "-", note = "查看任务概览、失败原因与事件流" } = {}) {
    const icon = this.querySelector("#status-detail-head-icon");
    const jobIdEl = this.querySelector("#status-detail-job-id");
    const noteEl = this.querySelector("#status-detail-head-note");
    if (icon) {
      icon.innerHTML = iconMarkup;
    }
    if (jobIdEl) {
      jobIdEl.textContent = jobId;
    }
    if (noteEl) {
      noteEl.textContent = note;
    }
  }

  renderStageHistory({ markup = "", emptyText = "暂无阶段记录", hasItems = false } = {}) {
    const list = this.querySelector("#overview-stage-list");
    const empty = this.querySelector("#overview-stage-empty");
    if (!list || !empty) {
      return;
    }
    if (!hasItems) {
      list.innerHTML = "";
      list.classList.add("hidden");
      empty.textContent = emptyText;
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = markup;
  }

  renderEvents({ markup = "", count = 0, emptyText = "暂无事件", hasItems = false } = {}) {
    const list = this.querySelector("#events-list");
    const empty = this.querySelector("#events-empty");
    const status = this.querySelector("#events-status");
    if (!list || !empty || !status) {
      return;
    }
    status.textContent = hasItems ? `最近 ${count} 条` : "暂无事件";
    if (!hasItems) {
      list.innerHTML = "";
      list.classList.add("hidden");
      empty.textContent = emptyText;
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = markup;
  }

  setRuntimeDetails(details = {}) {
    const entries = [
      ["runtime-current-stage", details.currentStage],
      ["runtime-stage-elapsed", details.stageElapsed],
      ["runtime-total-elapsed", details.totalElapsed],
      ["runtime-retry-count", details.retryCount],
      ["runtime-last-transition", details.lastTransition],
      ["runtime-terminal-reason", details.terminalReason],
      ["runtime-input-protocol", details.inputProtocol],
      ["runtime-stage-spec-version", details.stageSpecVersion],
      ["runtime-math-mode", details.mathMode],
    ];
    entries.forEach(([id, value]) => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        el.textContent = value ?? "-";
      }
    });
  }

  setFailureDetails(details = {}) {
    const entries = [
      ["failure-summary", details.summary],
      ["failure-category", details.category],
      ["failure-stage", details.stage],
      ["failure-root-cause", details.rootCause],
      ["failure-suggestion", details.suggestion],
      ["failure-last-log-line", details.lastLogLine],
      ["failure-retryable", details.retryable],
    ];
    entries.forEach(([id, value]) => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        el.textContent = value ?? "-";
      }
    });
  }

  renderSnapshot({
    headline = {},
    runtime = {},
    failure = {},
    stageHistory = {},
    events = {},
  } = {}) {
    this.setHeadline(headline);
    this.setRuntimeDetails(runtime);
    this.setFailureDetails(failure);
    this.renderStageHistory(stageHistory);
    this.renderEvents(events);
  }
}

if (!customElements.get("status-detail-dialog")) {
  customElements.define("status-detail-dialog", StatusDetailDialog);
}
