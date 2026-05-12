import { $ } from "../../dom.js";
import { API_PREFIX } from "../../constants.js";
import {
  getOcrProviderDefinition,
  normalizeOcrProvider,
  TRANSLATION_PROVIDER_DEFINITION,
} from "../../provider-config.js";
import {
  activateCredentialTabView,
  bindCredentialViewEvents,
  browserCredentialElements,
  closeCredentialDialog,
  credentialDialog,
  currentCredentialDialogSetupMode,
  openCredentialDialog,
  setCredentialDialogModeView,
  setDeepSeekAccountStatus,
  setDeepSeekValidationMessage,
  setDialogStatus,
  setOcrValidationMessage,
  syncOcrProviderControlsView,
  updateCredentialGateView,
} from "./view.js";

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
  queryDeepSeekBalance,
  onCredentialStateChange,
}) {
  function setCredentialDialogMode(setupMode = false) {
    setCredentialDialogModeView({ setupMode, activateCredentialTab });
  }

  function activateCredentialTab(tabName = "api") {
    activateCredentialTabView(tabName);
  }

  function currentOcrProvider() {
    return normalizeOcrProvider($("ocr_provider")?.value);
  }

  function syncOcrProviderControls(providerId = currentOcrProvider()) {
    const activeProvider = normalizeOcrProvider(providerId);
    syncOcrProviderControlsView(activeProvider);
  }

  function currentTimeLabel() {
    return new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
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

  function summarizeDeepSeekBalance(result) {
    const infos = Array.isArray(result?.balance_infos) ? result.balance_infos : [];
    const parts = infos
      .filter((item) => item && item.currency && item.total_balance)
      .map((item) => `${item.currency} ${item.total_balance}`);
    if (parts.length > 0) {
      return `余额 ${parts.join("，")}`;
    }
    if (result?.is_available) {
      return "余额可用";
    }
    return "余额不足";
  }

  async function runDeepSeekBalanceCheck(apiKey) {
    const modelApiKey = `${apiKey || ""}`.trim();
    if (!modelApiKey) {
      return { ok: false, status: "missing_key" };
    }
    if (!queryDeepSeekBalance) {
      return { ok: false, status: "unsupported" };
    }
    try {
      return await queryDeepSeekBalance(API_PREFIX, {
        api_key: modelApiKey,
        base_url: defaultModelBaseUrl(),
      });
    } catch (_err) {
      return { ok: false, status: "network_error" };
    }
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
    setDeepSeekAccountStatus("", "");
    setDialogStatus("", "");
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
        markConfigured: currentCredentialDialogSetupMode(),
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

  function openBrowserCredentialsDialog(options = {}) {
    const { dialog } = browserCredentialElements();
    if (!dialog) {
      return;
    }
    syncBrowserDialogFromHiddenInputs();
    setCredentialDialogMode(!!options.setupMode);
    activateCredentialTab("api");
    openCredentialDialog();
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
    const uploadEnabled = workflowNeedsUpload();
    if (state.desktopMode) {
      if (!updateCredentialGateView({
        desktopMode: true,
        show: false,
        uploadEnabled,
        uploadReady: !!state.uploadId,
      })) {
        return;
      }
      refreshSubmitControls();
      return;
    }
    const show = workflowNeedsCredentials() && !hasBrowserCredentials();
    if (!updateCredentialGateView({
      desktopMode: false,
      show,
      uploadEnabled,
      uploadReady: !!state.uploadId,
    })) {
      return;
    }
    refreshSubmitControls();
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
    setDeepSeekValidationMessage("正在检测 DeepSeek 和余额…");
    const result = await runDeepSeekConnectivityCheck(apiKeyInput?.value || "", { showResult: false });
    if (result.ok) {
      const balance = await runDeepSeekBalanceCheck(apiKeyInput?.value || "");
      if (balance.status === "unsupported_provider") {
        setDeepSeekValidationMessage("DeepSeek 可用", "valid");
        setDeepSeekAccountStatus("接口可用，当前 provider 不支持余额查询", "valid", currentTimeLabel());
        return;
      }
      if (balance.status === "network_error") {
        setDeepSeekValidationMessage("DeepSeek 可用，余额查询失败", "valid");
        setDeepSeekAccountStatus("接口可用，余额查询失败", "valid", currentTimeLabel());
        return;
      }
      const balanceSummary = summarizeDeepSeekBalance(balance);
      setDeepSeekValidationMessage(
        `DeepSeek 可用，${balanceSummary}`,
        balance.is_available ? "valid" : "error",
      );
      setDeepSeekAccountStatus(balanceSummary, balance.is_available ? "valid" : "error", currentTimeLabel());
      return;
    }
    setDeepSeekValidationMessage(
      result.summary || TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage,
      "error",
    );
    setDeepSeekAccountStatus(result.summary || "接口不可用", "error", currentTimeLabel());
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
      setDialogStatus(error?.message || String(error), "error");
      setDeepSeekValidationMessage(error?.message || String(error), "error");
      return;
    }
    onCredentialStateChange?.();
    setDialogStatus("", "");
    closeCredentialDialog();
  }

  bindCredentialViewEvents({
    resetMineruValidation: () => {
      resetOcrValidationCache();
      setOcrValidationMessage("", "", "mineru");
    },
    resetPaddleValidation: () => {
      resetOcrValidationCache();
      setOcrValidationMessage("", "", "paddle");
    },
    resetDeepSeekValidation: () => {
      setDeepSeekValidationMessage("", "");
    },
    validateOcr: handleBrowserOcrValidate,
    validateDeepSeek: handleBrowserDeepSeekValidate,
    save: handleBrowserCredentialSave,
    open: openBrowserCredentialsDialog,
    activateCredentialTab,
    changeProvider: (event) => {
      const provider = normalizeOcrProvider(event.currentTarget?.value);
      $("ocr_provider").value = provider;
      syncOcrProviderControls(provider);
    },
  });

  return {
    activateCredentialTab,
    ensureOcrCredentialsReady,
    hasBrowserCredentials,
    openBrowserCredentialsDialog,
    setDialogStatus,
    updateCredentialGate,
  };
}
