import { statusDetailDialogTemplate } from "./status-detail-dialog-template.js";
import {
  renderEvents,
  renderStageHistory,
  setFailureDetails,
  setHeadline,
  setRerunAction,
  setRuntimeDetails,
} from "./status-detail-dialog-rendering.js";
import {
  renderTranslationItemDetail,
  renderTranslationItems,
  renderTranslationReplay,
  renderTranslationSummary,
} from "./status-detail-dialog-translation.js";

class StatusDetailDialog extends HTMLElement {
  connectedCallback() {
    if (this.dataset.hydrated === "1") {
      return;
    }
    this.dataset.hydrated = "1";
    this.innerHTML = statusDetailDialogTemplate();
  }

  dialogElement() {
    return this.querySelector("#status-detail-dialog");
  }

  activateTab(name = "overview") {
    const tabs = this.querySelectorAll(".detail-tab");
    const panels = this.querySelectorAll(".detail-tab-panel");
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  open(tabName = "overview") {
    this.activateTab(tabName);
    this.dialogElement()?.showModal();
  }

  close() {
    this.dialogElement()?.close();
  }

  setHeadline({ iconMarkup = "", jobId = "-", note = "查看任务概览、失败原因与事件流" } = {}) {
    setHeadline(this, { iconMarkup, jobId, note });
  }

  renderStageHistory({ markup = "", emptyText = "暂无阶段记录", hasItems = false } = {}) {
    renderStageHistory(this, { markup, emptyText, hasItems });
  }

  renderEvents({ markup = "", count = 0, emptyText = "暂无事件", hasItems = false } = {}) {
    renderEvents(this, { markup, count, emptyText, hasItems });
  }

  setRuntimeDetails(details = {}) {
    setRuntimeDetails(this, details);
  }

  setFailureDetails(details = {}) {
    setFailureDetails(this, details);
  }

  setRerunAction({ enabled = false, status = "" } = {}) {
    setRerunAction(this, { enabled, status });
  }

  renderSnapshot({
    headline = {},
    runtime = {},
    failure = {},
    stageHistory = {},
    events = {},
    rerun = {},
  } = {}) {
    this.setHeadline(headline);
    this.setRuntimeDetails(runtime);
    this.setFailureDetails(failure);
    this.setRerunAction(rerun);
    this.renderStageHistory(stageHistory);
    this.renderEvents(events);
  }

  renderTranslationSummary(options = {}) {
    renderTranslationSummary(this, options);
  }

  renderTranslationItems(options = {}) {
    renderTranslationItems(this, options);
  }

  renderTranslationItemDetail(options = {}) {
    renderTranslationItemDetail(this, options);
  }

  renderTranslationReplay(options = {}) {
    renderTranslationReplay(this, options);
  }
}

if (!customElements.get("status-detail-dialog")) {
  customElements.define("status-detail-dialog", StatusDetailDialog);
}
