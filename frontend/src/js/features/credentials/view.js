import { $ } from "../../dom.js";
import { TRANSLATION_PROVIDER_DEFINITION, getOcrProviderDefinition } from "../../provider-config.js";

export function credentialDialog() {
  return $("browser-credentials-dialog");
}

export function currentCredentialDialogSetupMode() {
  return credentialDialog()?.dataset?.setupMode === "1";
}

export function setCredentialDialogModeView({ setupMode = false, activateCredentialTab }) {
  const dialog = credentialDialog();
  if (!dialog) {
    return;
  }
  dialog.dataset.setupMode = setupMode ? "1" : "0";
  $("browser-credentials-title").textContent = setupMode ? "首次配置" : "接口设置";
  const subtitle = $("browser-credentials-subtitle");
  if (subtitle) {
    const text = setupMode
      ? "填写 OCR Token 和 DeepSeek Key，检测通过后保存。"
      : "";
    subtitle.textContent = text;
    subtitle.classList.toggle("hidden", !text);
  }
  $("browser-credentials-save-btn").textContent = setupMode ? "保存并启动" : "保存";
  $("browser-credentials-tabs")?.classList.toggle("hidden", setupMode);
  if (setupMode) {
    activateCredentialTab("api");
  }
}

export function setDialogStatus(message = "", tone = "") {
  const el = $("browser-credentials-status");
  if (!el) {
    return;
  }
  const content = `${message || ""}`.trim();
  el.textContent = content;
  el.classList.toggle("hidden", !content);
  el.classList.toggle("is-valid", tone === "valid");
  el.classList.toggle("is-error", tone === "error");
}

export function activateCredentialTabView(tabName = "api") {
  const dialog = credentialDialog();
  if (!dialog) {
    return;
  }
  dialog.querySelectorAll("[data-credential-tab]").forEach((tab) => {
    const active = tab.dataset.credentialTab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  dialog.querySelectorAll("[data-credential-panel]").forEach((panel) => {
    const active = panel.dataset.credentialPanel === tabName;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

export function syncOcrProviderControlsView(providerId) {
  const activeProvider = `${providerId || ""}`.trim();
  const dialog = credentialDialog();
  if (!dialog) {
    return;
  }
  const apiSelect = $("browser-ocr-provider-select");
  if (apiSelect) {
    apiSelect.value = activeProvider;
  }
  dialog.querySelectorAll("[data-ocr-provider-panel]").forEach((panel) => {
    const active = panel.dataset.ocrProviderPanel === activeProvider;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

export function setOcrValidationMessage(message, tone = "", providerId = "") {
  const definition = getOcrProviderDefinition(providerId);
  const el = $(`browser-${definition.id}-validation`);
  if (!el) {
    return;
  }
  const content = `${message || ""}`.trim();
  el.textContent = content || definition.validationIdleMessage;
  el.classList.toggle("hidden", !content);
  el.classList.toggle("is-valid", tone === "valid");
  el.classList.toggle("is-error", tone === "error");
}

export function setDeepSeekValidationMessage(message, tone = "") {
  const el = $("browser-deepseek-validation");
  if (!el) {
    return;
  }
  const content = `${message || ""}`.trim();
  el.textContent = content || TRANSLATION_PROVIDER_DEFINITION.validationIdleMessage;
  el.classList.toggle("hidden", !content);
  el.classList.toggle("is-valid", tone === "valid");
  el.classList.toggle("is-error", tone === "error");
}

export function setDeepSeekAccountStatus(summary = "", tone = "", checkedAt = "") {
  const box = $("browser-deepseek-account-status");
  const summaryEl = $("browser-deepseek-account-summary");
  const timeEl = $("browser-deepseek-account-time");
  const content = `${summary || ""}`.trim();
  if (!box || !summaryEl || !timeEl) {
    return;
  }
  box.classList.toggle("hidden", !content);
  box.classList.toggle("is-valid", tone === "valid");
  box.classList.toggle("is-error", tone === "error");
  summaryEl.textContent = content || "未检测";
  timeEl.textContent = checkedAt ? `检测时间 ${checkedAt}` : "-";
}

export function browserCredentialElements() {
  return {
    dialog: $("browser-credentials-dialog"),
    mineruInput: $("browser-mineru-token"),
    paddleInput: $("browser-paddle-token"),
    apiKeyInput: $("browser-api-key"),
    mathModeSelect: $("browser-job-math-mode"),
    trigger: $("credentials-btn"),
  };
}

export function openCredentialDialog() {
  credentialDialog()?.showModal();
}

export function closeCredentialDialog() {
  credentialDialog()?.close();
}

export function updateCredentialGateView({
  desktopMode,
  show,
  uploadEnabled,
  uploadReady,
}) {
  const trigger = $("credentials-btn");
  const gate = $("credential-gate");
  const tile = $("file")?.closest(".upload-tile");
  const fileInput = $("file");
  const uploadGlyph = $("upload-glyph");
  const fileLabel = $("file-label");
  const uploadHelp = $("upload-help");
  const uploadMeta = document.querySelector(".upload-meta");
  const uploadStatus = $("upload-status");

  if (!gate || !tile || !fileInput) {
    return false;
  }
  if (desktopMode) {
    gate.classList.add("hidden");
    trigger?.classList.remove("is-nudged");
    tile.classList.toggle("is-locked", !uploadEnabled);
    fileInput.disabled = !uploadEnabled;
    uploadGlyph?.classList.toggle("hidden", !uploadEnabled);
    uploadMeta?.classList.toggle("hidden", !uploadEnabled);
    tile.classList.toggle("is-ready", uploadEnabled && uploadReady);
    return true;
  }
  gate.classList.toggle("hidden", !show);
  trigger?.classList.toggle("is-nudged", show);
  tile.classList.toggle("is-locked", show || !uploadEnabled);
  fileInput.disabled = show || !uploadEnabled;
  uploadGlyph?.classList.toggle("hidden", show || !uploadEnabled);
  fileLabel?.classList.toggle("hidden", show);
  uploadHelp?.classList.toggle("hidden", false);
  uploadMeta?.classList.toggle("hidden", show || !uploadEnabled);
  if (show) {
    uploadStatus?.classList.add("hidden");
  }
  tile.classList.toggle("is-ready", !show && uploadEnabled && uploadReady);
  return true;
}

export function bindCredentialViewEvents({
  resetMineruValidation,
  resetPaddleValidation,
  resetDeepSeekValidation,
  validateOcr,
  validateDeepSeek,
  save,
  open,
  activateCredentialTab,
  changeProvider,
}) {
  $("browser-mineru-token")?.addEventListener("input", resetMineruValidation);
  $("browser-paddle-token")?.addEventListener("input", resetPaddleValidation);
  $("browser-api-key")?.addEventListener("input", resetDeepSeekValidation);
  $("browser-mineru-validate-btn")?.addEventListener("click", validateOcr);
  $("browser-paddle-validate-btn")?.addEventListener("click", validateOcr);
  $("browser-deepseek-validate-btn")?.addEventListener("click", validateDeepSeek);
  $("browser-credentials-save-btn")?.addEventListener("click", save);
  $("credentials-btn")?.addEventListener("click", open);
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#credentials-btn")) {
      event.preventDefault();
      open?.();
    }
  });
  credentialDialog()?.querySelectorAll("[data-toggle-secret]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.toggleSecret || "");
      if (!input) {
        return;
      }
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.classList.toggle("is-revealed", !showing);
      button.setAttribute("aria-pressed", !showing ? "true" : "false");
    });
  });
  document.addEventListener("retainpdf:open-browser-credentials", (event) => {
    open(event?.detail || {});
  });
  credentialDialog()?.querySelectorAll("[data-credential-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateCredentialTab(tab.dataset.credentialTab || "api");
    });
  });
  $("browser-ocr-provider-select")?.addEventListener("change", changeProvider);
}
