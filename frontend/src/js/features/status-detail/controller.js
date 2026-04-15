import { $ } from "../../dom.js";

export function mountStatusDetailFeature() {
  function buildDetailPageUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    const url = new URL("./detail.html", window.location.href);
    url.searchParams.set("job_id", normalizedJobId);
    return url.toString();
  }

  function dialogComponent() {
    return document.querySelector("status-detail-dialog");
  }

  function activateDetailTab(name = "overview") {
    const component = dialogComponent();
    if (component?.activateTab) {
      component.activateTab(name);
      return;
    }
    const tabs = document.querySelectorAll(".detail-tab");
    const panels = document.querySelectorAll(".detail-tab-panel");
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

  function openStatusDetailDialog() {
    const component = dialogComponent();
    if (component?.open) {
      component.open("overview");
      return;
    }
    activateDetailTab("overview");
    $("status-detail-dialog")?.showModal();
  }

  function bindEvents() {
    $("status-detail-btn")?.addEventListener("click", openStatusDetailDialog);
    document.querySelectorAll(".detail-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activateDetailTab(tab.dataset.tab || "overview");
      });
    });
  }

  return {
    activateDetailTab,
    bindEvents,
    openStatusDetailDialog,
  };
}
