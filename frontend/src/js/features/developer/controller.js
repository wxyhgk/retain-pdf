import { $ } from "../../dom.js";

export function mountDeveloperFeature({
  syncDeveloperDialogFromState,
  updateDeveloperWorkflowFormState,
  saveDeveloperDialog,
  resetDeveloperDialog,
}) {
  function activateDeveloperTab(tabName = "model") {
    document.querySelectorAll("[data-developer-tab]").forEach((tab) => {
      const active = tab.dataset.developerTab === tabName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-developer-panel]").forEach((panel) => {
      const active = panel.dataset.developerPanel === tabName;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function showDeveloperSettingsDialog() {
    syncDeveloperDialogFromState?.();
    activateDeveloperTab("model");
    $("developer-dialog")?.showModal();
  }

  function openDeveloperDialog() {
    showDeveloperSettingsDialog();
  }

  function bindEvents() {
    $("developer-btn")?.addEventListener("click", openDeveloperDialog);
    $("developer-save-btn")?.addEventListener("click", () => saveDeveloperDialog?.());
    $("developer-reset-btn")?.addEventListener("click", () => resetDeveloperDialog?.());
    $("developer-workflow")?.addEventListener("change", () => updateDeveloperWorkflowFormState?.());
    document.querySelectorAll("[data-developer-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        activateDeveloperTab(tab.dataset.developerTab || "model");
      });
    });
  }

  return {
    activateDeveloperTab,
    bindEvents,
    openDeveloperDialog,
    showDeveloperSettingsDialog,
  };
}
