class BrowserCredentialsDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="browser-credentials-dialog" class="desktop-dialog">
        <form method="dialog" class="desktop-shell">
          <div class="desktop-head">
            <div class="credential-dialog-head">
              <h2>接口设置</h2>
            </div>
            <button id="browser-credentials-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div class="desktop-body credential-dialog-body">
            <div class="developer-tabs credential-tabs" role="tablist" aria-label="接口设置">
              <button id="browser-credential-tab-api" type="button" class="developer-tab credential-tab is-active" data-credential-tab="api" role="tab" aria-selected="true">API 设置</button>
              <button id="browser-credential-tab-task" type="button" class="developer-tab credential-tab" data-credential-tab="task" role="tab" aria-selected="false">任务选项</button>
            </div>
            <div class="credential-card-grid credential-panels">
              <section class="credential-panel is-active" data-credential-panel="api" role="tabpanel">
                <div class="credential-card-grid">
                  <section class="credential-card">
                    <div class="credential-card-head">
                      <div>
                        <h3>MinerU</h3>
                        <p>用于 OCR 解析和版面识别。</p>
                      </div>
                      <a class="credential-card-link" href="https://mineru.net/apiManage/docs?openApplyModal=true" target="_blank" rel="noopener noreferrer">获取 Token</a>
                    </div>
                    <label>
                      <span class="developer-label">
                        <span>MinerU Token</span>
                        <button type="button" class="developer-hint" aria-label="MinerU Token 说明" data-tooltip="MinerU Token 用于 OCR 解析和版面识别。可通过右上角获取 Token 链接前往 MinerU 控制台申请。">i</button>
                      </span>
                      <input id="browser-mineru-token" type="text" autocomplete="off" placeholder="填写 MinerU Token" />
                    </label>
                    <div class="credential-card-actions">
                      <button id="browser-mineru-validate-btn" type="button" class="secondary">检测 MinerU</button>
                      <span id="browser-mineru-validation" class="token-inline-status hidden">保存前会自动检测 MinerU Token。</span>
                    </div>
                  </section>

                  <section class="credential-card">
                    <div class="credential-card-head">
                      <div>
                        <h3>DeepSeek</h3>
                        <p>用于正文翻译和模型调用。</p>
                      </div>
                      <a class="credential-card-link" href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">获取 Key</a>
                    </div>
                    <label>
                      <span class="developer-label">
                        <span>DeepSeek Key</span>
                        <button type="button" class="developer-hint" aria-label="DeepSeek Key 说明" data-tooltip="DeepSeek Key 用于正文翻译和模型调用。可通过右上角获取 Key 链接前往 DeepSeek 平台创建。">i</button>
                      </span>
                      <input id="browser-api-key" type="text" autocomplete="off" placeholder="填写 DeepSeek API Key" />
                    </label>
                    <div class="credential-card-actions">
                      <button id="browser-deepseek-validate-btn" type="button" class="secondary">检测 DeepSeek</button>
                      <span id="browser-deepseek-validation" class="token-inline-status hidden">可检测 DeepSeek 接口是否连通。</span>
                    </div>
                  </section>
                </div>
              </section>

              <section class="credential-card credential-panel" data-credential-panel="task" role="tabpanel" hidden>
                <div class="credential-card-head">
                  <div>
                    <h3>任务选项</h3>
                    <p>控制公式处理方式和标题翻译行为。</p>
                  </div>
                </div>
                <label>
                  <span class="developer-label">
                    <span>公式模式</span>
                    <button type="button" class="developer-hint" aria-label="公式模式说明" data-tooltip="占位保护更稳，适合默认使用；直出公式会让模型直接生成公式，适合实验排查。">i</button>
                  </span>
                  <select id="browser-job-math-mode" aria-label="公式模式">
                    <option value="placeholder">占位保护</option>
                    <option value="direct_typst">直出公式</option>
                  </select>
                </label>
                <label>
                  <span class="developer-label">
                    <span>标题翻译</span>
                    <button type="button" class="developer-hint" aria-label="标题翻译说明" data-tooltip="勾选时翻译标题；取消勾选时会保留原文标题，只翻译正文内容。">i</button>
                  </span>
                  <span class="credential-toggle">
                    <input id="browser-translate-titles" type="checkbox" checked />
                    翻译标题
                  </span>
                </label>
              </section>
            </div>
            <div class="actions credential-dialog-actions">
              <button id="browser-credentials-save-btn" type="button">保存</button>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }
}

if (!customElements.get("browser-credentials-dialog")) {
  customElements.define("browser-credentials-dialog", BrowserCredentialsDialog);
}
