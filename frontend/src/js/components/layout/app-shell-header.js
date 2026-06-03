class AppShellHeader extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.classList.add("app-shell-header");
    this.innerHTML = `
      <header class="topbar library-topbar">
        <a class="hero-repo-link library-brand-link" href="https://github.com/wxyhgk/retain-pdf" target="_blank" rel="noopener noreferrer">
          <img class="hero-repo-logo" src="src/assets/RetainPDF-logo.svg" alt="RetainPDF logo" />
          <span>RetainPDF</span>
        </a>
        <div class="library-header-actions" aria-label="主页操作">
          <button id="library-add-pdf-btn" type="button" class="home-action-btn primary" aria-label="添加 PDF" title="添加 PDF">
            <span>添加 PDF</span>
          </button>
          <button id="credentials-btn" type="button" class="home-action-btn secondary" aria-label="接口设置" title="接口设置">
            <span>接口设置</span>
          </button>
          <button id="glossary-btn" type="button" class="home-action-btn secondary" aria-label="术语表" title="术语表">
            <span>术语表</span>
          </button>
          <button id="language-btn" type="button" class="home-action-btn secondary" aria-label="语言设置" title="语言设置">
            <span>语言</span>
          </button>
          <div class="app-update-wrapper">
            <button id="app-update-btn" type="button" class="home-action-btn secondary app-update-btn" aria-label="检查更新" title="检查更新" data-update-state="idle">
              <span>更新</span>
              <span class="app-update-dot" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div class="hero-actions hidden" aria-hidden="true">
          <button id="developer-btn" type="button" class="secondary hidden" aria-hidden="true">开发者</button>
          <button id="open-output-btn" type="button" class="secondary hidden">打开输出目录</button>
        </div>
      </header>
      <dialog id="app-update-dialog" class="desktop-dialog app-update-dialog">
        <form method="dialog" class="desktop-shell app-update-shell">
          <div class="app-update-head">
            <div>
              <h2 data-update-title>检查更新</h2>
              <p data-update-version>当前版本</p>
            </div>
            <button type="submit" class="desktop-close app-update-close" aria-label="关闭">×</button>
          </div>
          <div class="app-update-body">
            <div id="app-update-status" class="app-update-status hidden">正在检查 GitHub Releases...</div>
            <div class="app-update-notes" data-update-notes>正在准备检查更新。</div>
          </div>
          <div class="app-update-foot">
            <button id="app-update-check-btn" type="button" class="home-action-btn secondary">重新检查</button>
            <a class="app-update-link hidden" data-update-link href="#" target="_blank" rel="noopener noreferrer">打开 Release</a>
          </div>
        </form>
      </dialog>
    `;
  }
}

if (!customElements.get("app-shell-header")) {
  customElements.define("app-shell-header", AppShellHeader);
}
