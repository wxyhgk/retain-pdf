class InlineErrorBox extends HTMLElement {
  connectedCallback() {
    this.classList.add("log", "error-box", "inline-error-box");
    if (!this.textContent.trim()) {
      this.textContent = "-";
    }
    if (!this.classList.contains("hidden") && this.textContent.trim() === "-") {
      this.classList.add("hidden");
    }
    this.setAttribute("aria-live", "polite");
  }
}

if (!customElements.get("inline-error-box")) {
  customElements.define("inline-error-box", InlineErrorBox);
}
