import {
  activateDeveloperTabView,
  bindDeveloperEvents,
  openDeveloperDialogView,
} from "./view.js";

export function mountDeveloperFeature({
  syncDeveloperDialogFromState,
  updateDeveloperWorkflowFormState,
  saveDeveloperDialog,
  resetDeveloperDialog,
}) {
  function activateDeveloperTab(tabName = "model") {
    activateDeveloperTabView(tabName);
  }

  function showDeveloperSettingsDialog() {
    syncDeveloperDialogFromState?.();
    activateDeveloperTab("model");
    openDeveloperDialogView();
  }

  function openDeveloperDialog() {
    showDeveloperSettingsDialog();
  }

  function bindEvents() {
    bindDeveloperEvents({
      openDeveloperDialog,
      saveDeveloperDialog,
      resetDeveloperDialog,
      updateDeveloperWorkflowFormState,
      activateDeveloperTab,
    });
  }

  return {
    activateDeveloperTab,
    bindEvents,
    openDeveloperDialog,
    showDeveloperSettingsDialog,
  };
}
