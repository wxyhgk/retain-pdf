class DeveloperSettingsDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="developer-dialog" class="desktop-dialog">
        <form method="dialog" class="desktop-shell">
          <div class="desktop-head">
            <div class="credential-dialog-head">
              <h2>开发者设置</h2>
            </div>
            <button id="developer-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div class="desktop-body credential-dialog-body developer-dialog-body">
            <div class="developer-tabs" role="tablist" aria-label="开发者设置">
              <button id="developer-tab-model" type="button" class="developer-tab is-active" data-developer-tab="model" role="tab" aria-selected="true">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7.5h16M4 12h10M4 16.5h7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                </svg>
                <span>模型</span>
              </button>
              <button id="developer-tab-runtime" type="button" class="developer-tab" data-developer-tab="runtime" role="tab" aria-selected="false">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3.5v3m0 11v3m8.5-8.5h-3m-11 0h-3M18.01 5.99l-2.12 2.12M8.11 15.89l-2.12 2.12m0-12.02 2.12 2.12m7.78 7.78 2.12 2.12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6"/>
                </svg>
                <span>执行</span>
              </button>
            </div>

            <div class="developer-panels">
              <section id="developer-panel-model" class="developer-panel is-active" data-developer-panel="model" role="tabpanel">
                <div class="credential-card compact-card">
                  <label>
                    <span>任务工作流</span>
                    <select id="developer-workflow">
                      <option value="mineru">mineru · OCR + 翻译 + 渲染</option>
                      <option value="translate">translate · OCR + 翻译</option>
                      <option value="render">render · 复用已有任务产物重新渲染</option>
                    </select>
                  </label>
                  <label id="developer-render-source-wrap" class="hidden">
                    <span>Render 源任务 ID</span>
                    <input id="developer-render-source-job-id" type="text" autocomplete="off" placeholder="填写已有 job_id" />
                  </label>
                  <p id="developer-workflow-note" class="muted">\`mineru\` 会完整执行 OCR、翻译与 PDF 渲染。</p>
                  <label>
                    <span>模型 Base URL</span>
                    <input id="developer-base-url" type="text" autocomplete="off" placeholder="例如 https://api.deepseek.com/v1" />
                  </label>
                  <label>
                    <span>模型名称</span>
                    <input id="developer-model" type="text" autocomplete="off" placeholder="例如 deepseek-chat" />
                  </label>
                </div>
              </section>

              <section id="developer-panel-runtime" class="developer-panel" data-developer-panel="runtime" role="tabpanel" hidden>
                <div class="credential-card compact-card">
                  <div class="grid two developer-grid">
                    <label>
                      <span class="developer-label">
                        <span>翻译并发</span>
                        <button type="button" class="developer-hint" aria-label="翻译并发说明" data-tooltip="同时发送给翻译模型的并发任务数。更高通常更快，但更容易触发限流。">i</button>
                      </span>
                      <input id="developer-workers" type="number" min="1" step="1" inputmode="numeric" />
                    </label>
                    <label>
                      <span class="developer-label">
                        <span>渲染并发</span>
                        <button type="button" class="developer-hint" aria-label="渲染并发说明" data-tooltip="最终 PDF 渲染与编译时允许的并发数。">i</button>
                      </span>
                      <input id="developer-compile-workers" type="number" min="1" step="1" inputmode="numeric" />
                    </label>
                    <label>
                      <span class="developer-label">
                        <span>翻译批大小</span>
                        <button type="button" class="developer-hint" aria-label="翻译批大小说明" data-tooltip="每次提交给翻译模型的文本批次大小。过大可能影响稳定性。">i</button>
                      </span>
                      <input id="developer-batch-size" type="number" min="1" step="1" inputmode="numeric" />
                    </label>
                    <label>
                      <span class="developer-label">
                        <span>分类批大小</span>
                        <button type="button" class="developer-hint" aria-label="分类批大小说明" data-tooltip="论文领域识别与策略分类时使用的批大小。">i</button>
                      </span>
                      <input id="developer-classify-batch-size" type="number" min="1" step="1" inputmode="numeric" />
                    </label>
                    <label class="developer-span-full">
                      <span class="developer-label">
                        <span>超时秒数</span>
                        <button type="button" class="developer-hint" aria-label="超时秒数说明" data-tooltip="单个任务的总超时秒数。超过后任务会被后端终止。">i</button>
                      </span>
                      <input id="developer-timeout-seconds" type="number" min="1" step="1" inputmode="numeric" />
                    </label>
                  </div>
                </div>
              </section>
            </div>
            <div class="actions credential-dialog-actions">
              <button id="developer-reset-btn" type="button" class="secondary">恢复默认</button>
              <button id="developer-save-btn" type="button">保存</button>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }
}

if (!customElements.get("developer-settings-dialog")) {
  customElements.define("developer-settings-dialog", DeveloperSettingsDialog);
}
