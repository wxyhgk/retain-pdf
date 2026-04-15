class DeveloperAuthDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = `
      <dialog id="developer-auth-dialog" class="desktop-dialog developer-auth-dialog">
        <form method="dialog" class="desktop-shell">
          <div class="desktop-head">
            <div class="credential-dialog-head">
              <h2>开发者验证</h2>
            </div>
            <button id="developer-auth-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
          </div>
          <div class="desktop-body developer-auth-body">
            <label>
              <span>开发者密码</span>
              <input id="developer-auth-password" type="password" autocomplete="current-password" placeholder="请输入密码" />
            </label>
            <div id="developer-auth-error" class="upload-status hidden"></div>
            <div class="actions credential-dialog-actions">
              <button id="developer-auth-submit-btn" type="button">进入开发者设置</button>
            </div>
          </div>
        </form>
      </dialog>
    `;
  }
}

if (!customElements.get("developer-auth-dialog")) {
  customElements.define("developer-auth-dialog", DeveloperAuthDialog);
}
