import { $ } from "../../dom.js";

export function mountDeveloperFeature({
  developerPassword,
  developerAuthSessionKey,
  syncDeveloperDialogFromState,
  updateDeveloperWorkflowFormState,
  saveDeveloperDialog,
  resetDeveloperDialog,
}) {
  function isDeveloperAuthorized() {
    try {
      return window.sessionStorage?.getItem(developerAuthSessionKey) === "1";
    } catch (_err) {
      return false;
    }
  }

  function markDeveloperAuthorized() {
    try {
      window.sessionStorage?.setItem(developerAuthSessionKey, "1");
    } catch (_err) {
      // Ignore private mode/storage failures.
    }
  }

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
    if (isDeveloperAuthorized()) {
      showDeveloperSettingsDialog();
      return;
    }
    const passwordInput = $("developer-auth-password");
    const errorBox = $("developer-auth-error");
    if (passwordInput) {
      passwordInput.value = "";
    }
    if (errorBox) {
      errorBox.textContent = "";
      errorBox.classList.add("hidden");
    }
    $("developer-auth-dialog")?.showModal();
    passwordInput?.focus();
  }

  function submitDeveloperAuth() {
    const passwordInput = $("developer-auth-password");
    const errorBox = $("developer-auth-error");
    const password = passwordInput?.value || "";
    if (password !== developerPassword) {
      if (errorBox) {
        errorBox.textContent = "开发者密码错误。";
        errorBox.classList.remove("hidden");
      }
      passwordInput?.focus();
      passwordInput?.select();
      return;
    }
    markDeveloperAuthorized();
    $("developer-auth-dialog")?.close();
    showDeveloperSettingsDialog();
  }

  function bindEvents() {
    $("developer-btn")?.addEventListener("click", openDeveloperDialog);
    $("developer-auth-submit-btn")?.addEventListener("click", submitDeveloperAuth);
    $("developer-auth-password")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitDeveloperAuth();
      }
    });
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
    isDeveloperAuthorized,
    openDeveloperDialog,
    showDeveloperSettingsDialog,
    submitDeveloperAuth,
  };
}
