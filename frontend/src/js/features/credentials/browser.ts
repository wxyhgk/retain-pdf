import {
  getOcrProviderDefinition,
  normalizeOcrProvider,
  TRANSLATION_PROVIDER_DEFINITION,
} from "../../config/providers.js";
import {
  runOcrTokenValidation,
  type ProviderValidationResult,
} from "./validation.js";
import { handleBrowserDeepSeekValidate as runBrowserDeepSeekValidate } from "./deepseek-flow.js";
import {
  ocrTokenFromDialogValues,
  readCredentialDialogValues,
} from "./dialog-values.js";
import {
  defaultCredentialsStatePort,
} from "./default-state-port.js";
import { syncCredentialDialogFields } from "./dialog-sync.js";
import { ensureOcrCredentialValidationReady } from "./ocr-readiness-flow.js";
import {
  persistBrowserCredentialsFromDialog as persistBrowserCredentials,
  persistDesktopCredentialsFromDialog as persistDesktopCredentials,
} from "./persistence.js";
import { createCredentialRuntimeEnvPort } from "./runtime-env-port.js";
import { createCredentialUploadReadinessPort } from "./upload-readiness-port.js";
import { savePersistedBrowserStoredConfig } from "../../config/persisted-config.js";
import { notifyCredentialsChanged } from "../../reader/ai/config.js";
import type {
  CredentialsFields,
  CredentialsStatePort,
} from "./state.js";
import type {
  BindCredentialViewEventsOptions,
  OpenCredentialDialogOptions,
  UpdateCredentialGateViewOptions,
} from "./view.js";

export interface CredentialDialogElements {
  dialog?: HTMLDialogElement | HTMLElement | boolean | null;
  paddleInput?: HTMLInputElement | null;
  apiKeyInput?: HTMLInputElement | null;
  modelBaseUrlInput?: HTMLInputElement | null;
  modelNameInput?: HTMLInputElement | null;
  mathModeSelect?: HTMLSelectElement | null;
}

export interface CredentialDialogElementsPort {
  elements: () => CredentialDialogElements;
  syncOcrProviderControls?: (providerId?: string) => void;
}

export interface CredentialsViewPort {
  activateTab?: (tabName?: string) => void;
  bindEvents?: (handlers: BindCredentialViewEventsOptions) => void;
  closeDialog?: () => void;
  dialogElements?: () => CredentialDialogElements;
  openDialog?: () => void;
  setDeepSeekTopUpVisible?: (visible?: boolean) => void;
  setDeepSeekValidationMessage?: (message?: string, tone?: string) => void;
  setDialogMode?: (options?: {
    setupMode?: boolean;
    activateCredentialTab?: (tabName?: string) => void;
  }) => void;
  setDialogStatus?: (message?: string, tone?: string) => void;
  setHiddenOcrProvider?: (providerId?: string) => void;
  setOcrValidationMessage?: (message?: string, tone?: string, providerId?: string) => void;
  syncOcrProviderControls?: (providerId?: string) => void;
  updateCredentialGate?: (options?: UpdateCredentialGateViewOptions) => boolean | void;
}

export interface CredentialsRuntimeEnvPort {
  isDesktopMode?: () => boolean;
}

export interface CredentialsUploadStatePort {
  getSnapshot?: () => {
    uploadId?: string;
  };
}

export interface CredentialsBalanceStatePort {
  resetDeepSeekBalance?: () => void;
}

export interface CredentialsSetupModePort {
  currentSetupMode?: () => boolean;
}

export interface DeepSeekViewPort {
  elements?: () => CredentialDialogElements;
  setTopUpVisible?: (visible?: boolean) => void;
  setValidationMessage?: (message?: string, tone?: string) => void;
}

export interface OpenBrowserCredentialsDialogOptions {
  setupMode?: boolean;
}

export interface EnsureOcrCredentialsReadyOptions {
  onMissingToken?: () => void;
  onInvalidToken?: (result?: ProviderValidationResult | null) => void;
}

export interface UpdateCredentialGateOptions {
  workflowNeedsCredentials?: () => boolean;
  workflowNeedsUpload?: () => boolean;
  refreshSubmitControls?: () => void;
}

export interface RefreshDeepSeekBalanceOptions {
  silent?: boolean;
}

export interface MountBrowserCredentialsFeatureOptions {
  apiPrefix?: string;
  state?: unknown;
  applyHiddenCredentialInputs?: (credentials?: Partial<CredentialsFields> | unknown) => unknown;
  defaultPaddleToken?: () => string;
  defaultModelApiKey?: () => string;
  defaultModelBaseUrl?: () => string;
  getTaskOptions?: () => Record<string, unknown> | unknown;
  saveTaskOptions?: (options?: Record<string, unknown> | unknown) => unknown;
  saveBrowserStoredConfig?: (credentials?: CredentialsFields | Record<string, unknown> | unknown) => unknown;
  readHiddenCredentialInputs?: () => CredentialsFields | Record<string, unknown> | unknown;
  saveDesktopConfig?: (
    browserConfig?: Record<string, unknown> | unknown,
    afterSave?: () => unknown,
  ) => Promise<unknown> | unknown;
  checkApiConnectivity?: () => Promise<unknown> | unknown;
  validateOcrToken?: (
    apiPrefix?: unknown,
    providerId?: unknown,
    token?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  validateDeepSeekToken?: (
    apiPrefix?: unknown,
    payload?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  queryDeepSeekBalance?: (
    apiPrefix?: unknown,
    payload?: unknown,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  onCredentialStateChange?: () => void;
  uploadStatePort?: CredentialsUploadStatePort;
  credentialsStatePort?: CredentialsStatePort;
  runtimeEnvPort?: CredentialsRuntimeEnvPort;
  balanceStatePort?: CredentialsBalanceStatePort;
  legacyRuntimePort?: unknown;
  legacyValidationCachePort?: unknown;
  viewPort?: CredentialsViewPort;
  dialogElementsPort?: CredentialDialogElementsPort;
  deepSeekViewPort?: DeepSeekViewPort;
  setupModePort?: CredentialsSetupModePort;
}

function dialogDataset(dialog: CredentialDialogElements["dialog"]): DOMStringMap | undefined {
  if (dialog && typeof dialog === "object" && "dataset" in dialog) {
    return (dialog as HTMLElement).dataset;
  }
  return undefined;
}

export function mountBrowserCredentialsFeature({
  apiPrefix,
  state,
  applyHiddenCredentialInputs,
  defaultPaddleToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  getTaskOptions,
  saveTaskOptions,
  saveBrowserStoredConfig,
  readHiddenCredentialInputs,
  saveDesktopConfig,
  checkApiConnectivity,
  validateOcrToken,
  validateDeepSeekToken,
  queryDeepSeekBalance,
  onCredentialStateChange,
  uploadStatePort,
  credentialsStatePort = defaultCredentialsStatePort,
  runtimeEnvPort,
  balanceStatePort,
  legacyRuntimePort,
  legacyValidationCachePort,
  viewPort,
  dialogElementsPort,
  deepSeekViewPort = {
    elements: dialogElementsPort.elements,
    setTopUpVisible: viewPort.setDeepSeekTopUpVisible,
    setValidationMessage: viewPort.setDeepSeekValidationMessage,
  },
  setupModePort = {
    currentSetupMode: () => Boolean(dialogDataset(viewPort.dialogElements()?.dialog)?.setupMode === "1"),
  },
}: MountBrowserCredentialsFeatureOptions) {
  const uploadState = uploadStatePort || createCredentialUploadReadinessPort(state);
  const runtimeEnv = runtimeEnvPort || createCredentialRuntimeEnvPort(state);
  const balanceState = balanceStatePort || {
    resetDeepSeekBalance: () => credentialsStatePort.resetDeepSeekBalance?.(),
  };

  function readUploadState() {
    return uploadState.getSnapshot?.() || {};
  }

  function setCredentialDialogMode(setupMode = false) {
    viewPort.setDialogMode({ setupMode, activateCredentialTab });
  }

  function activateCredentialTab(tabName = "api") {
    viewPort.activateTab(tabName);
  }

  function currentOcrProvider() {
    return normalizeOcrProvider(credentialsStatePort.getCredentials?.().ocrProvider);
  }

  function syncOcrProviderControls(providerId = currentOcrProvider()) {
    const activeProvider = normalizeOcrProvider(providerId);
    viewPort.syncOcrProviderControls(activeProvider);
  }

  function readCurrentCredentials() {
    return credentialsStatePort.getCredentials?.() || readHiddenCredentialInputs();
  }

  function syncBrowserDialogFromCredentialState() {
    syncCredentialDialogFields({
      credentials: readCurrentCredentials(),
      taskOptions: getTaskOptions?.() || {},
      defaultModelBaseUrl,
      defaultModelApiKey,
      elementsPort: dialogElementsPort,
    });
    viewPort.setOcrValidationMessage("", "", "paddle");
    viewPort.setDeepSeekValidationMessage("", "");
    viewPort.setDeepSeekTopUpVisible(false);
    balanceState.resetDeepSeekBalance();
    viewPort.setDialogStatus("", "");
  }

  function hasBrowserCredentials() {
    return Boolean(credentialsStatePort.hasComplete?.({
      defaultPaddleToken,
    }));
  }

  function openBrowserCredentialsDialog(options: OpenBrowserCredentialsDialogOptions = {}) {
    const { dialog } = viewPort.dialogElements();
    if (!dialog) {
      return;
    }
    syncBrowserDialogFromCredentialState();
    setCredentialDialogMode(!!options.setupMode);
    activateCredentialTab("api");
    viewPort.openDialog();
  }

  /**
   * 设置面板内嵌模式（SettingsHubDialog API 区）：只做"从凭据状态回填表单 +
   * 复位到 api tab"，不经 viewPort.openDialog()——表单宿主是设置面板本身，
   * 没有独立弹窗可开。首次配置门（setupMode）仍走 openBrowserCredentialsDialog。
   */
  function prepareCredentialsPanels() {
    syncBrowserDialogFromCredentialState();
    setCredentialDialogMode(false);
    activateCredentialTab("api");
  }

  async function ensureOcrCredentialsReady({
    onMissingToken,
    onInvalidToken,
  }: EnsureOcrCredentialsReadyOptions = {}) {
    const provider = currentOcrProvider();
    const readiness = await ensureOcrCredentialValidationReady({
      apiPrefix,
      state,
      providerId: provider,
      credentials: readCurrentCredentials(),
      defaultPaddleToken,
      validateOcrToken,
      setOcrValidationMessage: viewPort.setOcrValidationMessage,
      showResult: !runtimeEnv.isDesktopMode(),
      credentialsStatePort,
      legacyRuntimePort,
      legacyValidationCachePort,
    });
    if (readiness.status === "missing_token") {
      onMissingToken?.();
      viewPort.setOcrValidationMessage(readiness.definition.validationMissingMessage, "error", readiness.definition.id);
      return false;
    }
    if (readiness.ok) {
      return true;
    }
    onInvalidToken?.(readiness.result);
    return false;
  }

  function updateCredentialGate({
    workflowNeedsCredentials,
    workflowNeedsUpload,
    refreshSubmitControls,
  }: UpdateCredentialGateOptions) {
    const uploadEnabled = workflowNeedsUpload();
    const desktopMode = runtimeEnv.isDesktopMode();
    const uploadSnapshot = readUploadState();
    if (desktopMode) {
      if (!viewPort.updateCredentialGate({
        desktopMode: true,
        show: false,
        uploadEnabled,
        uploadReady: !!uploadSnapshot.uploadId,
      })) {
        return;
      }
      refreshSubmitControls();
      return;
    }
    const show = workflowNeedsCredentials() && !hasBrowserCredentials();
    if (!viewPort.updateCredentialGate({
      desktopMode: false,
      show,
      uploadEnabled,
      uploadReady: !!uploadSnapshot.uploadId,
    })) {
      return;
    }
    refreshSubmitControls();
  }

  async function handleBrowserOcrValidate() {
    const provider = currentOcrProvider();
    await runOcrTokenValidation({
      apiPrefix,
      state,
      providerId: provider,
      token: ocrTokenFromDialogValues(readCredentialDialogValues({ elementsPort: dialogElementsPort })),
      validateOcrToken,
      setOcrValidationMessage: viewPort.setOcrValidationMessage,
      showResult: true,
      credentialsStatePort,
      legacyRuntimePort,
    });
  }

  async function handleBrowserDeepSeekValidate() {
    await runBrowserDeepSeekValidate({
      apiPrefix,
      state,
      defaultModelApiKey,
      validateDeepSeekToken,
      queryDeepSeekBalance,
      onBalanceChange: onCredentialStateChange,
      credentialsStatePort,
      legacyRuntimePort,
      viewPort: deepSeekViewPort,
    });
  }

  async function refreshDeepSeekBalance({ silent = true }: RefreshDeepSeekBalanceOptions = {}) {
    return runBrowserDeepSeekValidate({
      apiPrefix,
      state,
      defaultModelApiKey,
      validateDeepSeekToken,
      queryDeepSeekBalance,
      onBalanceChange: onCredentialStateChange,
      silent,
      credentialsStatePort,
      legacyRuntimePort,
      viewPort: deepSeekViewPort,
    });
  }

  async function handleBrowserCredentialSave() {
    const definition = getOcrProviderDefinition(currentOcrProvider());
    const existing = readCurrentCredentials();
    const raw = readCredentialDialogValues({ elementsPort: dialogElementsPort });
    // 密码框未回填/被清空时：空串表示「沿用已保存值」，避免把 localStorage 冲掉
    const values = {
      ...raw,
      paddleToken: `${raw.paddleToken || ""}`.trim() || `${existing.paddleToken || ""}`.trim(),
      modelApiKey: `${raw.modelApiKey || ""}`.trim() || `${existing.modelApiKey || ""}`.trim(),
    };
    const ocrToken = ocrTokenFromDialogValues(values);
    const modelApiKey = `${values.modelApiKey || ""}`.trim();
    // 免凭据 provider（如 local）没有可见/必填的 token 输入框，
    // ocrTokenFromDialogValues 读到的空值不该拦住保存。
    const ocrTokenMissing = definition.supportsValidation && !ocrToken;
    if (ocrTokenMissing || !modelApiKey) {
      if (ocrTokenMissing) {
        viewPort.setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
      }
      if (!modelApiKey) {
        viewPort.setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationMissingMessage, "error");
      }
      viewPort.setDialogStatus("请填写 OCR Token 与模型 API Key 后再保存", "error");
      return;
    }

    const nextCredentials = {
      ocrProvider: currentOcrProvider(),
      paddleToken: ocrToken,
      modelApiKey,
    };

    // 保存只做落盘；联网校验留给「检测」按钮。
    // 必须 await 完整持久化（含桌面 snapshot），再通知 AI 门禁刷新。
    try {
      credentialsStatePort.setCredentials?.(nextCredentials);
      // 统一走 savePersisted*：localStorage + 桌面 snapshot/IPC 一次写齐
      await savePersistedBrowserStoredConfig(nextCredentials);
      // 兼容旧注入（桌面 markConfigured / 任务选项）
      if (runtimeEnv.isDesktopMode() && saveDesktopConfig) {
        await persistDesktopCredentials({
          currentOcrProvider,
          defaultModelApiKey,
          defaultModelBaseUrl,
          saveTaskOptions,
          saveDesktopConfig,
          checkApiConnectivity: async () => {
            try {
              await checkApiConnectivity?.();
            } catch {
              /* ignore connectivity on save */
            }
          },
          values: { ...values, paddleToken: ocrToken, modelApiKey },
          setupModePort,
        });
      } else {
        persistBrowserCredentials({
          applyCredentialInputs: applyHiddenCredentialInputs,
          currentOcrProvider,
          defaultModelApiKey,
          defaultModelBaseUrl,
          saveTaskOptions,
          saveBrowserStoredConfig,
          values: { ...values, paddleToken: ocrToken, modelApiKey },
        });
      }
      // 再次保证内存态与刚写入的 next 一致
      credentialsStatePort.setCredentials?.(nextCredentials);
    } catch (error) {
      const message = (error as { message?: string })?.message || String(error);
      viewPort.setDialogStatus(message, "error");
      viewPort.setDeepSeekValidationMessage(message, "error");
      return;
    }
    // 写回可见输入，避免保存后输入框仍显示空
    syncBrowserDialogFromCredentialState();
    onCredentialStateChange?.();
    notifyCredentialsChanged();
    viewPort.setDialogStatus("已保存", "valid");
    // 首次配置弹窗保存后关闭；设置中心内嵌时保持打开以便继续改任务选项
    if (setupModePort.currentSetupMode?.()) {
      viewPort.closeDialog();
    }
  }

  viewPort.bindEvents({
    resetPaddleValidation: () => {
      credentialsStatePort.resetOcrValidationCache?.();
      viewPort.setOcrValidationMessage("", "", "paddle");
    },
    resetDeepSeekValidation: () => {
      viewPort.setDeepSeekValidationMessage("", "");
      viewPort.setDeepSeekTopUpVisible(false);
      balanceState.resetDeepSeekBalance();
      onCredentialStateChange?.();
    },
    validateOcr: handleBrowserOcrValidate,
    validateDeepSeek: handleBrowserDeepSeekValidate,
    save: handleBrowserCredentialSave,
    open: openBrowserCredentialsDialog,
    activateCredentialTab,
    changeProvider: (event) => {
      const target = event.currentTarget as HTMLSelectElement | HTMLInputElement | null;
      const provider = normalizeOcrProvider(target?.value);
      credentialsStatePort.patchCredentials?.({ ocrProvider: provider });
      viewPort.setHiddenOcrProvider(provider);
      syncOcrProviderControls(provider);
    },
  });

  return {
    activateCredentialTab,
    ensureOcrCredentialsReady,
    hasBrowserCredentials,
    openBrowserCredentialsDialog,
    prepareCredentialsPanels,
    refreshDeepSeekBalance,
    setDialogStatus: viewPort.setDialogStatus,
    updateCredentialGate,
  };
}
