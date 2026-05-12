export function statusDetailDialogTemplate() {
  return `
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
            <button id="detail-tab-translation" type="button" class="detail-tab detail-tab-advanced" data-tab="translation" role="tab" aria-selected="false">高级诊断</button>
          </div>

          <div class="detail-tab-panels">
            <section id="detail-panel-overview" class="detail-tab-panel is-active" data-panel="overview" role="tabpanel">
              <div class="detail-download-row">
                <a id="markdown-bundle-btn" class="button-link secondary disabled" href="#" target="_blank" rel="noopener noreferrer">下载 Markdown ZIP</a>
              </div>
              <div class="detail-grid">
                <div class="detail-item"><span class="label">当前阶段</span><span id="runtime-current-stage" class="info-value">-</span></div>
                <div class="detail-item"><span class="label">当前阶段耗时</span><span id="runtime-stage-elapsed" class="info-value">-</span></div>
                <div class="detail-item"><span class="label">累计耗时</span><span id="runtime-total-elapsed" class="info-value">-</span></div>
                <div class="detail-item"><span class="label">重试次数</span><span id="runtime-retry-count" class="info-value">0</span></div>
                <div class="detail-item"><span class="label">最近切换</span><span id="runtime-last-transition" class="info-value">-</span></div>
                <div class="detail-item"><span class="label">终态原因</span><span id="runtime-terminal-reason" class="info-value">-</span></div>
                <div class="detail-item"><span class="label">输入协议</span><span id="runtime-input-protocol" class="info-value">-</span></div>
                <div class="detail-item"><span class="label">Stage Schema</span><span id="runtime-stage-spec-version" class="info-value">-</span></div>
                <div class="detail-item"><span class="label">公式模式</span><span id="runtime-math-mode" class="info-value">-</span></div>
              </div>
              <div class="status-panel detail-stage-panel">
                <div class="status-panel-head"><h3>过程时间线</h3></div>
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
                <div class="failure-action-row">
                  <button id="failure-rerun-btn" type="button" class="button-link secondary" disabled>从断点恢复/重新运行</button>
                  <span id="failure-rerun-status" class="status-panel-note">失败后如后端允许，可基于已有产物创建恢复任务。</span>
                </div>
                <div class="failure-hero-card">
                  <span class="label">失败摘要</span>
                  <span id="failure-summary" class="info-value">-</span>
                </div>
                <div class="info-list detail-info-list">
                  <div class="info-row"><span class="label">分类</span><span id="failure-category" class="info-value">-</span></div>
                  <div class="info-row"><span class="label">阶段</span><span id="failure-stage" class="info-value">-</span></div>
                  <div class="info-row"><span class="label">根因</span><span id="failure-root-cause" class="info-value">-</span></div>
                  <div class="info-row"><span class="label">建议</span><span id="failure-suggestion" class="info-value">-</span></div>
                  <div class="info-row"><span class="label">最近日志</span><span id="failure-last-log-line" class="info-value">-</span></div>
                  <div class="info-row"><span class="label">可重试</span><span id="failure-retryable" class="info-value">-</span></div>
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

            <section id="detail-panel-translation" class="detail-tab-panel" data-panel="translation" role="tabpanel" hidden>
              <div class="status-panel translation-debug-panel">
                <div class="status-panel-head">
                  <h3>翻译调试</h3>
                  <span id="translation-debug-status" class="status-panel-note">按 item 排查为什么没翻译、为什么保留原文</span>
                </div>
                <div id="translation-debug-empty" class="events-empty hidden">暂无翻译调试数据</div>
                <div id="translation-debug-content" class="translation-debug-content">
                  <section class="translation-summary-shell">
                    <div class="translation-summary-grid">
                      <div class="translation-summary-card"><span class="label">已翻译</span><span id="translation-count-translated" class="info-value">-</span></div>
                      <div class="translation-summary-card"><span class="label">保留原文</span><span id="translation-count-kept-origin" class="info-value">-</span></div>
                      <div class="translation-summary-card"><span class="label">已跳过</span><span id="translation-count-skipped" class="info-value">-</span></div>
                      <div class="translation-summary-card"><span class="label">Provider</span><span id="translation-provider-family" class="info-value">-</span></div>
                    </div>
                    <div class="translation-summary-notes">
                      <span id="translation-summary-scope" class="status-panel-note">摘要统计范围：-</span>
                      <span id="translation-list-filter" class="status-panel-note">当前列表筛选：-</span>
                    </div>
                  </section>

                  <section class="translation-filter-panel">
                    <div class="translation-filter-row">
                      <label class="translation-filter-field">
                        <span class="label">状态</span>
                        <select id="translation-filter-final-status">
                          <option value="kept_origin" selected>保留原文</option>
                          <option value="translated">已翻译</option>
                          <option value="skipped">已跳过</option>
                          <option value="">全部</option>
                        </select>
                      </label>
                      <label class="translation-filter-field translation-filter-search">
                        <span class="label">检索</span>
                        <input id="translation-filter-query" type="search" placeholder="输入 item_id、路由、原文片段" />
                      </label>
                      <button id="translation-filter-apply" type="button" class="button-link secondary">刷新</button>
                    </div>
                  </section>

                  <div class="translation-debug-layout">
                    <section class="translation-debug-column translation-debug-column-list">
                      <div class="translation-debug-subhead"><h4>Item 列表</h4><span id="translation-items-meta" class="status-panel-note">-</span></div>
                      <div class="translation-panel-body">
                        <div id="translation-items-loading" class="events-empty hidden">正在读取翻译 item...</div>
                        <div id="translation-items-empty" class="events-empty hidden">没有匹配的翻译 item</div>
                        <div id="translation-items-list" class="translation-items-list"></div>
                      </div>
                      <div class="translation-items-pagination">
                        <button id="translation-items-prev" type="button" class="button-link secondary" disabled>上一页</button>
                        <span id="translation-items-page" class="status-panel-note">-</span>
                        <button id="translation-items-next" type="button" class="button-link secondary" disabled>下一页</button>
                      </div>
                    </section>

                    <section class="translation-debug-column translation-debug-column-detail">
                      <div class="translation-debug-subhead"><h4>Item 详情</h4><span id="translation-item-meta" class="status-panel-note">-</span></div>
                      <div class="translation-panel-body translation-panel-body-detail">
                        <div id="translation-item-loading" class="events-empty hidden">正在读取 item 详情...</div>
                        <div id="translation-item-empty" class="events-empty">请选择左侧 item</div>
                        <div id="translation-item-detail" class="translation-item-detail hidden"></div>
                      </div>
                      <div class="translation-replay-actions">
                        <button id="translation-item-replay" type="button" class="button-link secondary" disabled>重放当前 item</button>
                        <span id="translation-replay-status" class="status-panel-note">-</span>
                      </div>
                      <div id="translation-replay-result" class="translation-replay-result hidden"></div>
                    </section>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </form>
    </dialog>
  `;
}
