class PageRangeSummary extends HTMLElement {
  connectedCallback() {
    this.classList.add("page-range-summary");
    if (!this.textContent.trim()) {
      this.textContent = "已选择页码：-";
    }
    if (!this.classList.contains("hidden") && this.textContent.includes("已选择页码：-")) {
      this.classList.add("hidden");
    }
  }
}

if (!customElements.get("page-range-summary")) {
  customElements.define("page-range-summary", PageRangeSummary);
}
