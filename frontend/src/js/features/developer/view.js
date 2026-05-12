import { $ } from "../../dom.js";

const DEVELOPER_EASTER_EGG_SEQUENCE = "bbpp";

export function activateDeveloperTabView(tabName = "model") {
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

export function openDeveloperDialogView() {
  $("developer-dialog")?.showModal();
}

function revealDeveloperEntry() {
  const button = $("developer-btn");
  if (!button) {
    return;
  }
  button.classList.remove("hidden");
  button.removeAttribute("aria-hidden");
}

function bindDeveloperEasterEgg() {
  let buffer = "";
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable) {
      return;
    }
    const key = `${event.key || ""}`.toLowerCase();
    if (key.length !== 1) {
      return;
    }
    buffer = `${buffer}${key}`.slice(-DEVELOPER_EASTER_EGG_SEQUENCE.length);
    if (buffer === DEVELOPER_EASTER_EGG_SEQUENCE) {
      revealDeveloperEntry();
      buffer = "";
    }
  });
}

export function bindDeveloperEvents({
  openDeveloperDialog,
  saveDeveloperDialog,
  resetDeveloperDialog,
  updateDeveloperWorkflowFormState,
  activateDeveloperTab,
}) {
  $("developer-btn")?.addEventListener("click", openDeveloperDialog);
  bindDeveloperEasterEgg();
  $("developer-save-btn")?.addEventListener("click", () => saveDeveloperDialog?.());
  $("developer-reset-btn")?.addEventListener("click", () => resetDeveloperDialog?.());
  $("developer-workflow")?.addEventListener("change", () => updateDeveloperWorkflowFormState?.());
  document.querySelectorAll("[data-developer-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateDeveloperTab(tab.dataset.developerTab || "model");
    });
  });
}
