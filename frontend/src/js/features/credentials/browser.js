import { $ } from "../../dom.js";
import {
  API_PREFIX,
  DEFAULT_MODEL_VERSION,
} from "../../constants.js";

export function mountBrowserCredentialsFeature({
  state,
  applyKeyInputs,
  defaultMineruToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  openSettingsDialog,
  saveBrowserStoredConfig,
  validateMineruToken,
  onCredentialStateChange,
}) {
  function setMineruValidationMessage(message, tone = "") {
    const el = $("browser-mineru-validation");
    if (!el) {
      return;
    }
    const content = `${message || ""}`.trim();
    el.textContent = content || "保存前会自动检测 MinerU Token。";
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
    el.textContent = content || "可检测 DeepSeek 接口是否连通。";
    el.classList.toggle("hidden", !content);
    el.classList.toggle("is-valid", tone === "valid");
    el.classList.toggle("is-error", tone === "error");
  }

  function resetMineruValidationCache() {
    state.validatedMineruToken = "";
    state.mineruValidationStatus = "";
  }

  async function runMineruTokenValidation(token, { showResult = true } = {}) {
    const mineruToken = `${token || ""}`.trim();
    if (!mineruToken) {
      resetMineruValidationCache();
      if (showResult) {
        setMineruValidationMessage("请先填写 MinerU Token。", "error");
      }
      return { ok: false, status: "unauthorized" };
    }
    if (showResult) {
      setMineruValidationMessage("正在检测 MinerU Token…");
    }
    try {
      const result = await validateMineruToken(API_PREFIX, {
        mineru_token: mineruToken,
        base_url: "https://mineru.net",
        model_version: DEFAULT_MODEL_VERSION,
      });
      state.validatedMineruToken = mineruToken;
      state.mineruValidationStatus = result.status || "";
      if (showResult) {
        const hint = result.operator_hint ? ` ${result.operator_hint}` : "";
        const message = result.summary || `MinerU Token 检测结果：${result.status || "unknown"}`;
        setMineruValidationMessage(`${message}${hint}`.trim(), result.ok ? "valid" : "error");
      }
      return result;
    } catch (_err) {
      resetMineruValidationCache();
      if (showResult) {
        setMineruValidationMessage("MinerU Token 检测失败，请稍后重试。", "error");
      }
      return {
        ok: false,
        status: "network_error",
        summary: "MinerU Token 检测失败，请稍后重试。",
      };
    }
  }

  async function runDeepSeekConnectivityCheck(apiKey, { showResult = true } = {}) {
    const modelApiKey = `${apiKey || ""}`.trim();
    if (!modelApiKey) {
      if (showResult) {
        setDeepSeekValidationMessage("请先填写 DeepSeek Key。", "error");
      }
      return { ok: false, status: 0 };
    }
    if (showResult) {
      setDeepSeekValidationMessage("正在检测 DeepSeek 接口…");
    }
    const baseUrl = defaultModelBaseUrl().replace(/\/$/, "");
    try {
      const resp = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${modelApiKey}`,
        },
      });
      if (resp.ok) {
        if (showResult) {
          setDeepSeekValidationMessage("DeepSeek 接口连接成功。", "valid");
        }
        return { ok: true, status: resp.status };
      }
      const summary = resp.status === 401
        ? "DeepSeek Key 无效或已过期。"
        : `DeepSeek 接口返回 ${resp.status}。`;
      if (showResult) {
        setDeepSeekValidationMessage(summary, "error");
      }
      return { ok: false, status: resp.status, summary };
    } catch (_err) {
      if (showResult) {
        setDeepSeekValidationMessage("DeepSeek 接口检测失败，请检查网络或浏览器跨域限制。", "error");
      }
      return { ok: false, status: 0 };
    }
  }

  function browserCredentialElements() {
    return {
      dialog: $("browser-credentials-dialog"),
      mineruInput: $("browser-mineru-token"),
      apiKeyInput: $("browser-api-key"),
      trigger: $("credentials-btn"),
    };
  }

  function syncBrowserDialogFromHiddenInputs() {
    const { mineruInput, apiKeyInput } = browserCredentialElements();
    if (mineruInput) {
      mineruInput.value = $("mineru_token").value || "";
    }
    if (apiKeyInput) {
      apiKeyInput.value = $("api_key").value || "";
    }
    setMineruValidationMessage("", "");
    setDeepSeekValidationMessage("", "");
  }

  function persistBrowserCredentialsFromDialog() {
    const { mineruInput, apiKeyInput } = browserCredentialElements();
    applyKeyInputs(
      mineruInput?.value?.trim() || "",
      apiKeyInput?.value?.trim() || "",
    );
    saveBrowserStoredConfig();
  }

  function hasBrowserCredentials() {
    return Boolean(($("mineru_token").value || "").trim() && ($("api_key").value || "").trim());
  }

  function openBrowserCredentialsDialog() {
    const { dialog } = browserCredentialElements();
    if (!dialog) {
      return;
    }
    syncBrowserDialogFromHiddenInputs();
    dialog.showModal();
  }

  async function ensureMineruTokenReady({ onMissingToken, onInvalidToken } = {}) {
    const token = ($("mineru_token").value || defaultMineruToken()).trim();
    if (!token) {
      onMissingToken?.();
      setMineruValidationMessage("请先填写 MinerU Token。", "error");
      return false;
    }
    if (state.validatedMineruToken === token && state.mineruValidationStatus === "valid") {
      return true;
    }
    const result = await runMineruTokenValidation(token, { showResult: !state.desktopMode });
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

    if (!gate || !tile || !fileInput || state.desktopMode) {
      return;
    }
    const show = workflowNeedsCredentials() && !hasBrowserCredentials();
    const uploadEnabled = workflowNeedsUpload();
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

  async function handleBrowserMineruValidate() {
    const { mineruInput } = browserCredentialElements();
    await runMineruTokenValidation(mineruInput?.value || "", { showResult: true });
  }

  async function handleBrowserDeepSeekValidate() {
    const { apiKeyInput } = browserCredentialElements();
    await runDeepSeekConnectivityCheck(apiKeyInput?.value || "", { showResult: true });
  }

  async function handleBrowserCredentialSave() {
    const { mineruInput } = browserCredentialElements();
    const validation = await runMineruTokenValidation(mineruInput?.value || "", { showResult: true });
    if (!validation.ok) {
      return;
    }
    persistBrowserCredentialsFromDialog();
    onCredentialStateChange?.();
    $("browser-credentials-dialog")?.close();
  }

  $("browser-mineru-token")?.addEventListener("input", () => {
    resetMineruValidationCache();
    setMineruValidationMessage("", "");
  });
  $("browser-api-key")?.addEventListener("input", () => {
    setDeepSeekValidationMessage("", "");
  });
  $("browser-mineru-validate-btn")?.addEventListener("click", handleBrowserMineruValidate);
  $("browser-deepseek-validate-btn")?.addEventListener("click", handleBrowserDeepSeekValidate);
  $("browser-credentials-save-btn")?.addEventListener("click", handleBrowserCredentialSave);
  $("credentials-btn")?.addEventListener("click", () => {
    if (state.desktopMode) {
      openSettingsDialog();
      return;
    }
    openBrowserCredentialsDialog();
  });

    return {
      ensureMineruTokenReady,
      hasBrowserCredentials,
      openBrowserCredentialsDialog,
      updateCredentialGate,
    };
}
