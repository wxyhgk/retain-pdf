class DesktopSettingsDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="desktop-settings-dialog" class="desktop-dialog">
        <form method="dialog" class="desktop-shell">
          <div class="desktop-head">
            <h2>设置</h2>
            <button id="desktop-settings-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div class="desktop-body">
            <div class="grid two">
              <label>
                <span>MinerU Token</span>
                <input id="settings-mineru-token" type="text" autocomplete="off" />
              </label>
              <label>
                <span>DeepSeek Key</span>
                <input id="settings-model-api-key" type="text" autocomplete="off" />
              </label>
            </div>
            <div id="desktop-settings-error" class="upload-status hidden"></div>
            <div class="actions">
              <button id="desktop-settings-save-btn" type="button">保存设置</button>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }
}

if (!customElements.get("desktop-settings-dialog")) {
  customElements.define("desktop-settings-dialog", DesktopSettingsDialog);
}
