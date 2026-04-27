import { $ } from "../../dom.js";
import { API_PREFIX } from "../../constants.js";
import {
  getOcrProviderDefinition,
  normalizeOcrProvider,
  TRANSLATION_PROVIDER_DEFINITION,
} from "../../provider-config.js";

export function mountBrowserCredentialsFeature({
  state,
  applyKeyInputs,
  defaultMineruToken,
  defaultPaddleToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  getTaskOptions,
  saveTaskOptions,
  saveBrowserStoredConfig,
  saveDesktopConfig,
  checkApiConnectivity,
  validateOcrToken,
  validateDeepSeekToken,
  onCredentialStateChange,
}) {
  function credentialDialog() {
    return $("browser-credentials-dialog");
  }

  function activateCredentialTab(tabName = "api") {
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

  function currentOcrProvider() {
    return normalizeOcrProvider($("ocr_provider")?.value);
  }

  function syncOcrProviderControls(providerId = currentOcrProvider()) {
    const activeProvider = normalizeOcrProvider(providerId);
    const dialog = credentialDialog();
    if (!dialog) {
      return;
    }
    const apiSelect = $("browser-ocr-provider-select");
    const taskSelect = $("browser-task-ocr-provider-select");
    if (apiSelect) {
      apiSelect.value = activeProvider;
    }
    if (taskSelect) {
      taskSelect.value = activeProvider;
    }
    dialog.querySelectorAll("[data-ocr-provider-panel]").forEach((panel) => {
      const active = panel.dataset.ocrProviderPanel === activeProvider;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function setOcrValidationMessage(message, tone = "", providerId = currentOcrProvider()) {
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

  function setDeepSeekValidationMessage(message, tone = "") {
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

  function resetOcrValidationCache() {
    state.validatedOcrProvider = "";
    state.validatedOcrToken = "";
    state.ocrValidationStatus = "";
  }

  async function runOcrTokenValidation(providerId, token, { showResult = true } = {}) {
    const definition = getOcrProviderDefinition(providerId);
    const normalizedToken = `${token || ""}`.trim();
    if (!normalizedToken) {
      resetOcrValidationCache();
      if (showResult) {
        setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
      }
      return { ok: false, status: "unauthorized" };
    }
    if (!definition.supportsValidation) {
      state.validatedOcrProvider = definition.id;
      state.validatedOcrToken = normalizedToken;
      state.ocrValidationStatus = "skipped";
      if (showResult) {
        setOcrValidationMessage(definition.validationUnavailableMessage, "", definition.id);
      }
      return {
        ok: true,
        status: "skipped",
        summary: definition.validationUnavailableMessage,
      };
    }
    if (showResult) {
      setOcrValidationMessage(`正在检测 ${definition.label} Token…`, "", definition.id);
    }
    try {
      const result = await validateOcrToken(API_PREFIX, definition.id, normalizedToken);
      state.validatedOcrProvider = definition.id;
      state.validatedOcrToken = normalizedToken;
      state.ocrValidationStatus = result.status || "";
      if (showResult) {
        const hint = result.operator_hint ? ` ${result.operator_hint}` : "";
        const message = result.summary || `${definition.label} Token 检测结果：${result.status || "unknown"}`;
        setOcrValidationMessage(`${message}${hint}`.trim(), result.ok ? "valid" : "error", definition.id);
      }
      return result;
    } catch (_err) {
      resetOcrValidationCache();
      if (showResult) {
        setOcrValidationMessage(`${definition.label} Token 检测失败，请稍后重试。`, "error", definition.id);
      }
      return {
        ok: false,
        status: "network_error",
        summary: `${definition.label} Token 检测失败，请稍后重试。`,
      };
    }
  }

  async function runDeepSeekConnectivityCheck(apiKey, { showResult = true } = {}) {
    const modelApiKey = `${apiKey || ""}`.trim();
    if (!modelApiKey) {
      if (showResult) {
        setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationMissingMessage, "error");
      }
      return { ok: false, status: 0 };
    }
    if (showResult) {
      setDeepSeekValidationMessage("正在检测 DeepSeek 接口…");
    }
    try {
      const result = await validateDeepSeekToken(API_PREFIX, {
        api_key: modelApiKey,
        base_url: defaultModelBaseUrl(),
      });
      if (showResult) {
        setDeepSeekValidationMessage(
          result.summary || (result.ok
            ? TRANSLATION_PROVIDER_DEFINITION.validationSuccessMessage
            : TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage),
          result.ok ? "valid" : "error",
        );
      }
      return result;
    } catch (_err) {
      if (showResult) {
        setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage, "error");
      }
      return { ok: false, status: 0 };
    }
  }

  function browserCredentialElements() {
    return {
      dialog: $("browser-credentials-dialog"),
      mineruInput: $("browser-mineru-token"),
      paddleInput: $("browser-paddle-token"),
      apiKeyInput: $("browser-api-key"),
      mathModeSelect: $("browser-job-math-mode"),
      trigger: $("credentials-btn"),
    };
  }

  function syncBrowserDialogFromHiddenInputs() {
    const {
      mineruInput,
      paddleInput,
      apiKeyInput,
      mathModeSelect,
    } = browserCredentialElements();
    const taskOptions = getTaskOptions?.() || {};
    if (mineruInput) {
      mineruInput.value = $("mineru_token").value || "";
    }
    if (paddleInput) {
      paddleInput.value = $("paddle_token").value || "";
    }
    if (apiKeyInput) {
      apiKeyInput.value = $("api_key").value || "";
    }
    syncOcrProviderControls(currentOcrProvider());
    if (mathModeSelect) {
      mathModeSelect.value = taskOptions.mathMode === "placeholder" ? "placeholder" : "direct_typst";
    }
    setOcrValidationMessage("", "", "mineru");
    setOcrValidationMessage("", "", "paddle");
    setDeepSeekValidationMessage("", "");
  }

  function persistBrowserCredentialsFromDialog() {
    const {
      mineruInput,
      paddleInput,
      apiKeyInput,
      mathModeSelect,
    } = browserCredentialElements();
    applyKeyInputs({
      ocrProvider: currentOcrProvider(),
      mineruToken: mineruInput?.value?.trim() || "",
      paddleToken: paddleInput?.value?.trim() || "",
      modelApiKey: apiKeyInput?.value?.trim() || "",
    });
    saveTaskOptions?.({
      mathMode: mathModeSelect?.value || "direct_typst",
      translateTitles: true,
    });
    saveBrowserStoredConfig();
  }

  async function persistDesktopCredentialsFromDialog() {
    const {
      mineruInput,
      paddleInput,
      apiKeyInput,
      mathModeSelect,
    } = browserCredentialElements();
    const provider = currentOcrProvider();
    const mineruToken = mineruInput?.value?.trim() || "";
    const paddleToken = paddleInput?.value?.trim() || "";
    const modelApiKey = apiKeyInput?.value?.trim() || "";
    await saveDesktopConfig?.(
      mineruToken,
      modelApiKey,
      async () => {
        await checkApiConnectivity?.();
      },
      {
        ocrProvider: provider,
        paddleToken,
      },
    );
    saveTaskOptions?.({
      mathMode: mathModeSelect?.value || "direct_typst",
      translateTitles: true,
    });
  }

  function hasBrowserCredentials() {
    const definition = getOcrProviderDefinition(currentOcrProvider());
    return Boolean(($(`${definition.tokenField}`)?.value || "").trim() && ($("api_key").value || "").trim());
  }

  function openBrowserCredentialsDialog() {
    const { dialog } = browserCredentialElements();
    if (!dialog) {
      return;
    }
    syncBrowserDialogFromHiddenInputs();
    activateCredentialTab("api");
    dialog.showModal();
  }

  async function ensureOcrCredentialsReady({ onMissingToken, onInvalidToken } = {}) {
    const provider = currentOcrProvider();
    const definition = getOcrProviderDefinition(provider);
    const fallbackToken = definition.id === "paddle" ? defaultPaddleToken() : defaultMineruToken();
    const token = ($(`${definition.tokenField}`)?.value || fallbackToken).trim();
    if (!token) {
      onMissingToken?.();
      setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
      return false;
    }
    if (state.validatedOcrProvider === definition.id
      && state.validatedOcrToken === token
      && ["valid", "skipped"].includes(state.ocrValidationStatus)) {
      return true;
    }
    const result = await runOcrTokenValidation(definition.id, token, { showResult: !state.desktopMode });
    if (result.ok) {
      return true;
    }
    onInvalidToken?.(result);
    return false;
  }

  function updateCredentialGate({
    workflowNeedsCredentials,
    workflowNeedsUpload,
    refreshSubmitControls,
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
      return;
    }
    const uploadEnabled = workflowNeedsUpload();
    if (state.desktopMode) {
      gate.classList.add("hidden");
      trigger?.classList.remove("is-nudged");
      tile.classList.toggle("is-locked", !uploadEnabled);
      fileInput.disabled = !uploadEnabled;
      uploadGlyph?.classList.toggle("hidden", !uploadEnabled);
      uploadMeta?.classList.toggle("hidden", !uploadEnabled);
      tile.classList.toggle("is-ready", uploadEnabled && !!state.uploadId);
      refreshSubmitControls();
      return;
    }
    const show = workflowNeedsCredentials() && !hasBrowserCredentials();
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
    refreshSubmitControls();
    tile.classList.toggle("is-ready", !show && uploadEnabled && !!state.uploadId);
  }

  function currentProviderInputValue() {
    const { mineruInput, paddleInput } = browserCredentialElements();
    return currentOcrProvider() === "paddle" ? paddleInput?.value || "" : mineruInput?.value || "";
  }

  async function handleBrowserOcrValidate() {
    await runOcrTokenValidation(currentOcrProvider(), currentProviderInputValue(), { showResult: true });
  }

  async function handleBrowserDeepSeekValidate() {
    const { apiKeyInput } = browserCredentialElements();
    await runDeepSeekConnectivityCheck(apiKeyInput?.value || "", { showResult: true });
  }

  async function handleBrowserCredentialSave() {
    const definition = getOcrProviderDefinition(currentOcrProvider());
    const { mineruInput, paddleInput, apiKeyInput } = browserCredentialElements();
    const ocrToken = (definition.id === "paddle" ? paddleInput?.value : mineruInput?.value)?.trim() || "";
    const modelApiKey = apiKeyInput?.value?.trim() || "";
    if (!ocrToken || !modelApiKey) {
      if (!ocrToken) {
        setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
      }
      if (!modelApiKey) {
        setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationMissingMessage, "error");
      }
      return;
    }
    const validation = await runOcrTokenValidation(definition.id, ocrToken, { showResult: true });
    if (!validation.ok) {
      return;
    }
    try {
      if (state.desktopMode) {
        await persistDesktopCredentialsFromDialog();
      } else {
        persistBrowserCredentialsFromDialog();
      }
    } catch (error) {
      setDeepSeekValidationMessage(error?.message || String(error), "error");
      return;
    }
    onCredentialStateChange?.();
    $("browser-credentials-dialog")?.close();
  }

  $("browser-mineru-token")?.addEventListener("input", () => {
    resetOcrValidationCache();
    setOcrValidationMessage("", "", "mineru");
  });
  $("browser-paddle-token")?.addEventListener("input", () => {
    resetOcrValidationCache();
    setOcrValidationMessage("", "", "paddle");
  });
  $("browser-api-key")?.addEventListener("input", () => {
    setDeepSeekValidationMessage("", "");
  });
  $("browser-mineru-validate-btn")?.addEventListener("click", handleBrowserOcrValidate);
  $("browser-paddle-validate-btn")?.addEventListener("click", handleBrowserOcrValidate);
  $("browser-deepseek-validate-btn")?.addEventListener("click", handleBrowserDeepSeekValidate);
  $("browser-credentials-save-btn")?.addEventListener("click", handleBrowserCredentialSave);
  $("credentials-btn")?.addEventListener("click", openBrowserCredentialsDialog);
  credentialDialog()?.querySelectorAll("[data-credential-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateCredentialTab(tab.dataset.credentialTab || "api");
    });
  });
  $("browser-ocr-provider-select")?.addEventListener("change", (event) => {
    const provider = normalizeOcrProvider(event.currentTarget?.value);
    $("ocr_provider").value = provider;
    syncOcrProviderControls(provider);
  });
  $("browser-task-ocr-provider-select")?.addEventListener("change", (event) => {
    const provider = normalizeOcrProvider(event.currentTarget?.value);
    $("ocr_provider").value = provider;
    syncOcrProviderControls(provider);
  });

  return {
    activateCredentialTab,
    ensureOcrCredentialsReady,
    hasBrowserCredentials,
    openBrowserCredentialsDialog,
    updateCredentialGate,
  };
}
