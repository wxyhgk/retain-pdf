class LanguageSettingsDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="language-dialog" class="desktop-dialog">
        <form method="dialog" class="desktop-shell">
          <div class="desktop-head">
            <div class="credential-dialog-head">
              <h2>语言设置</h2>
            </div>
            <button id="language-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div class="desktop-body credential-dialog-body">
            <div class="credential-card compact-card">
              <label>
                <span>界面语言</span>
                <select id="ui-language-select" disabled>
                  <option value="zh-CN" selected>简体中文</option>
                </select>
              </label>
              <p class="muted">界面语言暂不支持切换，后续版本将开放更多选项。</p>
            </div>
            <div class="credential-card compact-card" style="margin-top: 16px;">
              <label>
                <span>目标语言</span>
                <select id="target-language-select">
                </select>
              </label>
              <p class="muted">翻译 PDF 时输出的语言类型。</p>
            </div>
          </div>
          <div class="desktop-foot">
            <button id="language-save-btn" type="button" class="home-action-btn primary">保存</button>
            <button id="language-cancel-btn" type="submit" class="home-action-btn secondary">取消</button>
          </div>
        </form>
      </dialog>
    `;
  }
}

if (!customElements.get("language-settings-dialog")) {
  customElements.define("language-settings-dialog", LanguageSettingsDialog);
}
