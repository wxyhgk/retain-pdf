class AppShellHeader extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.classList.add("app-shell-header");
    this.innerHTML = `
      <header class="topbar">
        <div class="brand-mark" aria-hidden="true"></div>
        <div class="hero-actions">
          <button id="developer-btn" type="button" class="secondary">开发者</button>
          <button id="desktop-settings-btn" type="button" class="secondary hidden">设置</button>
          <button id="open-output-btn" type="button" class="secondary hidden">打开输出目录</button>
        </div>
      </header>

      <section class="hero hero-single">
        <div class="hero-copy">
          <a class="hero-repo-link" href="https://github.com/wxyhgk/retain-pdf" target="_blank" rel="noopener noreferrer">
            <img class="hero-repo-logo" src="src/assets/RetainPDF-logo.svg" alt="RetainPDF logo" />
            <span>RetainPDF</span>
          </a>
        </div>
      </section>
    `;
  }
}

if (!customElements.get("app-shell-header")) {
  customElements.define("app-shell-header", AppShellHeader);
}
