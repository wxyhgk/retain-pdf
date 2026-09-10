import {
  getOcrProviderDefinition,
  getTranslationProviderDefinition,
  inferTranslationProvider,
  normalizeOcrProvider,
  normalizeTranslationProvider,
  TRANSLATION_PROVIDER_DEFINITION,
  TRANSLATION_PROVIDER_OPTIONS,
} from "@/platform/config/providers.js";
import {
  runOcrTokenValidation,
  type ProviderValidationResult,
} from "./validation.js";
import { handleBrowserDeepSeekValidate as runBrowserDeepSeekValidate } from "./deepseek-flow.js";
import {
  buildTaskOptionsFromDialogValues,
  ocrTokenFromDialogValues,
  readCredentialDialogValues,
} from "./dialog-values.js";
import {
  defaultCredentialsStatePort,
} from "./default-state-port.js";
import { syncCredentialDialogFields } from "./dialog-sync.js";
import { ensureOcrCredentialValidationReady } from "./ocr-readiness-flow.js";
import {
  persistDesktopCredentialsFromDialog as persistDesktopCredentials,
} from "./persistence.js";
import { createCredentialRuntimeEnvPort } from "./runtime-env-port.js";
import { createCredentialUploadReadinessPort } from "./upload-readiness-port.js";
import { savePersistedBrowserStoredConfig } from "@/platform/config/persisted-config.js";
import { notifyCredentialsChanged } from "@/features/reader/domain.js";
import type {
  CredentialsFields,
  CredentialsStatePort,
} from "./state.js";
import type {
  BindCredentialViewEventsOptions,
  OpenCredentialDialogOptions,
  UpdateCredentialGateViewOptions,
} from "@/features/credentials/domain/view-contracts.js";

export interface CredentialDialogElements {
  dialog?: HTMLDialogElement | HTMLElement | boolean | null;
  paddleInput?: HTMLInputElement | null;
  apiKeyInput?: HTMLInputElement | null;
  modelBaseUrlInput?: HTMLInputElement | null;
  modelNameInput?: HTMLInputElement | null;
  translationWorkersInput?: HTMLInputElement | null;
  mathModeSelect?: HTMLSelectElement | null;
}

export interface CredentialDialogElementsPort {
  elements: () => CredentialDialogElements;
  syncOcrProviderControls?: (providerId?: string) => void;
  syncTranslationProvider?: (baseUrl?: string) => void;
}

export interface CredentialsViewPort {
  activateTab?: (tabName?: string) => void;
  bindEvents?: (handlers: BindCredentialViewEventsOptions) => void;
  closeDialog?: () => void;
  dialogElements?: () => CredentialDialogElements;
  openDialog?: () => void;
  setDeepSeekTopUpVisible?: (visible?: boolean) => void;
  setTranslationProvider?: (provider?: string) => void;
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

function translationConfigError(baseUrl = "", model = "") {
  const normalizedBaseUrl = `${baseUrl || ""}`.trim();
  if (!normalizedBaseUrl) return "请填写翻译 API URL";
  try {
    const parsed = new URL(normalizedBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.host) {
      return "翻译 API URL 必须是有效的 http(s) 地址";
    }
    if (parsed.username || parsed.password) {
      return "翻译 API URL 不能包含用户名或密码";
    }
  } catch {
    return "翻译 API URL 必须是有效的 http(s) 地址";
  }
  if (!`${model || ""}`.trim()) return "请填写翻译模型名称";
  return "";
}

function translationWorkersError(value: unknown, providerId = "custom") {
  const workers = Number(value);
  const definition = getTranslationProviderDefinition(providerId);
  const maxWorkers = Number(definition.maxWorkers) || 100;
  if (!Number.isInteger(workers) || workers < 1 || workers > maxWorkers) {
    return `翻译并发数请输入 1–${maxWorkers} 的整数`;
  }
  return "";
}

type TranslationProfile = {
  apiKey: string;
  baseUrl: string;
  model: string;
  workers: number;
};

function translationProfileDefaults(providerId = "custom"): TranslationProfile {
  const definition = getTranslationProviderDefinition(providerId);
  return {
    apiKey: "",
    baseUrl: definition.baseUrl || "",
    model: definition.defaultModel || "",
    workers: Number(definition.defaultWorkers) || 5,
  };
}

function normalizeTranslationProfile(
  providerId = "custom",
  candidate: Record<string, unknown> = {},
): TranslationProfile {
  const defaults = translationProfileDefaults(providerId);
  const definition = getTranslationProviderDefinition(providerId);
  const workers = Number(candidate.workers);
  const maxWorkers = Number(definition.maxWorkers) || 100;
  return {
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey : defaults.apiKey,
    baseUrl: providerId === "custom"
      ? `${candidate.baseUrl || defaults.baseUrl}`.trim()
      : defaults.baseUrl,
    model: `${candidate.model || defaults.model}`.trim(),
    workers: Number.isInteger(workers) && workers > 0 && workers <= maxWorkers
      ? workers
      : defaults.workers,
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
  hasCredentials?: () => boolean;
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
  listCredentials?: (apiPrefix?: string) => Promise<any>;
  createCredential?: (apiPrefix: string | undefined, payload: Record<string, unknown>) => Promise<any>;
  updateCredential?: (
    apiPrefix: string | undefined,
    credentialRef: string,
    payload: Record<string, unknown>,
  ) => Promise<any>;
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
  listCredentials,
  createCredential,
  updateCredential,
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
  let credentialVaultRevision: number | undefined;
  let ocrCredentialRevision: number | undefined;
  let translationCredentialRevision: number | undefined;
  let credentialSaveInFlight = false;
  let lastCustomTranslationBaseUrl = "";
  let currentTranslationProvider = "deepseek";
  let translationProfiles: Record<string, TranslationProfile> = Object.fromEntries(
    TRANSLATION_PROVIDER_OPTIONS.map((provider) => [
      provider.id,
      translationProfileDefaults(provider.id),
    ]),
  );

  function hydrateTranslationProfiles(
    credentials: Record<string, unknown> = {},
    taskOptions: Record<string, unknown> = {},
  ) {
    const storedProfiles = taskOptions.translationProfiles
      && typeof taskOptions.translationProfiles === "object"
      ? taskOptions.translationProfiles as Record<string, Record<string, unknown>>
      : {};
    translationProfiles = Object.fromEntries(
      TRANSLATION_PROVIDER_OPTIONS.map((provider) => [
        provider.id,
        normalizeTranslationProfile(provider.id, storedProfiles[provider.id] || {}),
      ]),
    );
    const inferredProvider = inferTranslationProvider(`${taskOptions.baseUrl || ""}`);
    currentTranslationProvider = normalizeTranslationProvider(
      `${taskOptions.translationProvider || inferredProvider}`,
    );
    if (!translationProfiles[currentTranslationProvider]?.apiKey && credentials.modelApiKey) {
      translationProfiles[currentTranslationProvider] = normalizeTranslationProfile(
        currentTranslationProvider,
        {
          ...(storedProfiles[currentTranslationProvider] || {}),
          apiKey: `${credentials.modelApiKey || ""}`,
          baseUrl: `${taskOptions.baseUrl || ""}`,
          model: `${taskOptions.model || ""}`,
          workers: taskOptions.workers,
        },
      );
    }
    lastCustomTranslationBaseUrl = translationProfiles.custom?.baseUrl || "";
  }

  function captureCurrentTranslationProfile() {
    const elements = dialogElementsPort.elements();
    translationProfiles[currentTranslationProvider] = normalizeTranslationProfile(
      currentTranslationProvider,
      {
        apiKey: elements.apiKeyInput?.value || "",
        baseUrl: elements.modelBaseUrlInput?.value || "",
        model: elements.modelNameInput?.value || "",
        workers: elements.translationWorkersInput?.value || "",
      },
    );
    if (currentTranslationProvider === "custom") {
      lastCustomTranslationBaseUrl = translationProfiles.custom.baseUrl;
    }
  }

  function persistableTranslationProfiles() {
    return translationProfiles;
  }

  function applyTranslationProfile(providerId = "custom") {
    const provider = normalizeTranslationProvider(providerId);
    const definition = getTranslationProviderDefinition(provider);
    const profile = translationProfiles[provider] || translationProfileDefaults(provider);
    const elements = dialogElementsPort.elements();
    currentTranslationProvider = provider;
    if (elements.apiKeyInput) elements.apiKeyInput.value = profile.apiKey;
    if (elements.modelBaseUrlInput) {
      elements.modelBaseUrlInput.value = provider === "custom"
        ? (profile.baseUrl || lastCustomTranslationBaseUrl)
        : definition.baseUrl;
    }
    if (elements.modelNameInput) elements.modelNameInput.value = profile.model;
    if (elements.translationWorkersInput) elements.translationWorkersInput.value = `${profile.workers}`;
    viewPort.setTranslationProvider?.(provider);
  }

  function translationProvider(baseUrl = "") {
    const provider = inferTranslationProvider(baseUrl);
    return provider === "custom" ? "openai_compatible" : provider;
  }

  async function refreshCredentialReferences({ persist = true } = {}) {
    if (!listCredentials) return null;
    const result = await listCredentials(apiPrefix);
    credentialVaultRevision = Number.isFinite(Number(result?.revision))
      ? Number(result.revision)
      : undefined;
    const items = Array.isArray(result?.credentials) ? result.credentials : [];
    const translationCandidates = items.filter(
      (item) => item?.kind === "translation_api_key" && item?.configured !== false,
    );
    const currentCredentials = readCurrentCredentials();
    const existingTranslationRef = `${currentCredentials?.translationCredentialRef || ""}`.trim();
    const selectedTranslation = translationCandidates.find((item) => item?.credential_ref === existingTranslationRef)
      || translationCandidates.sort((a, b) => `${b?.updated_at || ""}`.localeCompare(`${a?.updated_at || ""}`))[0]
      || null;
    const translationCredentialRef = `${selectedTranslation?.credential_ref || ""}`.trim();
    translationCredentialRevision = Number.isFinite(Number(selectedTranslation?.revision))
      ? Number(selectedTranslation.revision)
      : undefined;

    const provider = currentOcrProvider();
    const ocrCandidates = items.filter((item) => (
      item?.kind === "ocr_provider_token"
      && item?.configured !== false
      && `${item?.provider || ""}`.trim().toLowerCase() === provider
    ));
    const existingOcrRef = `${currentCredentials?.ocrCredentialRef || ""}`.trim();
    const selectedOcr = ocrCandidates.find((item) => item?.credential_ref === existingOcrRef)
      || ocrCandidates.sort((a, b) => `${b?.updated_at || ""}`.localeCompare(`${a?.updated_at || ""}`))[0]
      || null;
    const ocrCredentialRef = `${selectedOcr?.credential_ref || ""}`.trim();
    ocrCredentialRevision = Number.isFinite(Number(selectedOcr?.revision))
      ? Number(selectedOcr.revision)
      : undefined;

    credentialsStatePort.patchCredentials?.({
      ocrCredentialRef,
      translationCredentialRef,
    });
    if (persist && (
      translationCredentialRef !== existingTranslationRef
      || ocrCredentialRef !== existingOcrRef
    )) {
      await savePersistedBrowserStoredConfig(readCurrentCredentials());
    }
    if (ocrCredentialRef && translationCredentialRef && runtimeEnv.isDesktopMode() && saveDesktopConfig) {
      const restoredCredentials = readCurrentCredentials();
      await saveDesktopConfig({
        ocrProvider: provider,
        ocrCredentialRef,
        paddleToken: restoredCredentials.paddleToken || "",
        translationCredentialRef,
        modelApiKey: restoredCredentials.modelApiKey || "",
        markConfigured: true,
      });
    }
    return { ocr: selectedOcr, translation: selectedTranslation };
  }

  async function storeOcrCredential({ secret, provider }: { secret: string; provider: string }) {
    const normalizedSecret = `${secret || ""}`.trim();
    let existingRef = `${readCurrentCredentials()?.ocrCredentialRef || ""}`.trim();
    if (!normalizedSecret) return existingRef;
    if (!createCredential || !updateCredential || !listCredentials) {
      throw new Error("当前前端未接入安全凭据服务，请刷新后重试");
    }
    if (credentialVaultRevision === undefined) {
      await refreshCredentialReferences({ persist: false });
    }
    existingRef = `${readCurrentCredentials()?.ocrCredentialRef || ""}`.trim();
    const normalizedProvider = normalizeOcrProvider(provider);
    const payload = {
      kind: "ocr_provider_token",
      provider: normalizedProvider,
      label: `${getOcrProviderDefinition(normalizedProvider).label} OCR`,
      secret: normalizedSecret,
      ...(credentialVaultRevision === undefined
        ? {}
        : { expected_revision: credentialVaultRevision }),
      ...(existingRef && ocrCredentialRevision !== undefined
        ? { expected_credential_revision: ocrCredentialRevision }
        : {}),
    };
    const result = existingRef
      ? await updateCredential(apiPrefix, existingRef, payload)
      : await createCredential(apiPrefix, payload);
    credentialVaultRevision = Number.isFinite(Number(result?.revision))
      ? Number(result.revision)
      : credentialVaultRevision;
    ocrCredentialRevision = Number.isFinite(Number(result?.credential?.revision))
      ? Number(result.credential.revision)
      : ocrCredentialRevision;
    return `${result?.credential?.credential_ref || existingRef}`.trim();
  }

  async function storeTranslationCredential({ secret, baseUrl }: { secret: string; baseUrl: string }) {
    const normalizedSecret = `${secret || ""}`.trim();
    let existingRef = `${readCurrentCredentials()?.translationCredentialRef || ""}`.trim();
    if (!normalizedSecret) return existingRef;
    if (!createCredential || !updateCredential || !listCredentials) {
      throw new Error("当前前端未接入安全凭据服务，请刷新后重试");
    }
    if (credentialVaultRevision === undefined) {
      await refreshCredentialReferences({ persist: false });
    }
    existingRef = `${readCurrentCredentials()?.translationCredentialRef || ""}`.trim();
    const payload = {
      kind: "translation_api_key",
      provider: translationProvider(baseUrl),
      label: "翻译 API",
      secret: normalizedSecret,
      ...(credentialVaultRevision === undefined
        ? {}
        : { expected_revision: credentialVaultRevision }),
      ...(existingRef && translationCredentialRevision !== undefined
        ? { expected_credential_revision: translationCredentialRevision }
        : {}),
    };
    const result = existingRef
      ? await updateCredential(apiPrefix, existingRef, payload)
      : await createCredential(apiPrefix, payload);
    credentialVaultRevision = Number.isFinite(Number(result?.revision))
      ? Number(result.revision)
      : credentialVaultRevision;
    translationCredentialRevision = Number.isFinite(Number(result?.credential?.revision))
      ? Number(result.credential.revision)
      : translationCredentialRevision;
    return `${result?.credential?.credential_ref || existingRef}`.trim();
  }

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
    return credentialsStatePort.getCredentials();
  }

  function syncBrowserDialogFromCredentialState() {
    const credentials = readCurrentCredentials();
    const taskOptions = (getTaskOptions?.() || {}) as Record<string, unknown>;
    hydrateTranslationProfiles(credentials as unknown as Record<string, unknown>, taskOptions);
    const profile = translationProfiles[currentTranslationProvider]
      || translationProfileDefaults(currentTranslationProvider);
    syncCredentialDialogFields({
      credentials: { ...credentials, modelApiKey: profile.apiKey },
      taskOptions: {
        ...taskOptions,
        baseUrl: profile.baseUrl,
        model: profile.model,
        workers: profile.workers,
      },
      defaultModelBaseUrl,
      defaultModelApiKey,
      elementsPort: dialogElementsPort,
    });
    viewPort.setTranslationProvider?.(currentTranslationProvider);
    viewPort.setOcrValidationMessage("", "", "paddle");
    viewPort.setDeepSeekValidationMessage("", "");
    if (credentials.ocrCredentialRef) {
      viewPort.setOcrValidationMessage("Paddle Token 已安全保存", "valid", "paddle");
    }
    if (credentials.translationCredentialRef) {
      viewPort.setDeepSeekValidationMessage("翻译 API Key 已安全保存", "valid");
    }
    viewPort.setDeepSeekTopUpVisible(false);
    balanceState.resetDeepSeekBalance();
    viewPort.setDialogStatus("", "");
  }

  function hasBrowserCredentials() {
    return Boolean(credentialsStatePort.hasComplete?.({
      defaultPaddleToken,
    }));
  }

  function hasOcrCredentials() {
    const credentials = readCurrentCredentials();
    return Boolean(
      credentials.ocrCredentialRef
      || credentialsStatePort.getOcrToken?.({ defaultPaddleToken }),
    );
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
    hasCredentials,
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
    const credentialsReady = hasCredentials?.() ?? hasBrowserCredentials();
    const show = workflowNeedsCredentials() && !credentialsReady;
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
    const token = ocrTokenFromDialogValues(
      readCredentialDialogValues({ elementsPort: dialogElementsPort }),
    );
    if (!token && readCurrentCredentials().ocrCredentialRef) {
      viewPort.setOcrValidationMessage(
        "Paddle Token 已安全保存；如需重新检测，请输入新 Token",
        "valid",
        provider,
      );
      return;
    }
    await runOcrTokenValidation({
      apiPrefix,
      state,
      providerId: provider,
      token,
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

  async function performBrowserCredentialSave() {
    const definition = getOcrProviderDefinition(currentOcrProvider());
    const existing = readCurrentCredentials();
    captureCurrentTranslationProfile();
    const raw = readCredentialDialogValues({ elementsPort: dialogElementsPort });
    const existingTaskOptions = (getTaskOptions?.() || {}) as Record<string, unknown>;
    // 输入框留空时沿用当前值，避免保存其他设置时误删凭据。
    const values = {
      ...raw,
      paddleToken: `${raw.paddleToken || ""}`.trim() || `${existing.paddleToken || ""}`.trim(),
      modelApiKey: `${raw.modelApiKey || ""}`.trim(),
      modelBaseUrl: `${raw.modelBaseUrl || ""}`.trim()
        || `${existingTaskOptions.baseUrl || ""}`.trim()
        || `${defaultModelBaseUrl?.() || ""}`.trim(),
      modelName: `${raw.modelName || ""}`.trim()
        || `${existingTaskOptions.model || ""}`.trim(),
      translationWorkers: `${raw.translationWorkers || ""}`.trim()
        || `${existingTaskOptions.workers || getTranslationProviderDefinition(currentTranslationProvider).defaultWorkers || 5}`,
    };
    const ocrToken = ocrTokenFromDialogValues(values);
    const modelApiKey = `${values.modelApiKey || ""}`.trim();
    const existingOcrCredentialRef = `${existing.ocrCredentialRef || ""}`.trim();
    const existingTranslationCredentialRef = `${existing.translationCredentialRef || ""}`.trim();
    const translationError = translationConfigError(values.modelBaseUrl, values.modelName);
    const workersError = translationWorkersError(values.translationWorkers, currentTranslationProvider);
    if ((!ocrToken && !existingOcrCredentialRef)
      || (!modelApiKey && !existingTranslationCredentialRef)
      || translationError
      || workersError) {
      if (!ocrToken && !existingOcrCredentialRef) {
        viewPort.setOcrValidationMessage(definition.validationMissingMessage, "error", definition.id);
      }
      if (!modelApiKey && !existingTranslationCredentialRef) {
        viewPort.setDeepSeekValidationMessage(TRANSLATION_PROVIDER_DEFINITION.validationMissingMessage, "error");
      } else if (translationError || workersError) {
        viewPort.setDeepSeekValidationMessage(translationError || workersError, "error");
      }
      viewPort.setDialogStatus(
        translationError || workersError || "请填写尚未保存的 OCR Token 或翻译 API Key",
        "error",
      );
      return;
    }

    translationProfiles[currentTranslationProvider] = normalizeTranslationProfile(
      currentTranslationProvider,
      {
        apiKey: values.modelApiKey,
        baseUrl: values.modelBaseUrl,
        model: values.modelName,
        workers: values.translationWorkers,
      },
    );
    const nextTaskOptions = {
      ...buildTaskOptionsFromDialogValues({
        values,
        defaultModelBaseUrl,
      }),
      translationProvider: currentTranslationProvider,
      translationProfiles: persistableTranslationProfiles(),
    };

    // 保存只做落盘；联网校验留给「检测」按钮。
    // 必须 await 完整持久化（含桌面 snapshot），再通知 AI 门禁刷新。
    try {
      const ocrCredentialRef = await storeOcrCredential({
        secret: ocrToken,
        provider: currentOcrProvider(),
      });
      const translationCredentialRef = await storeTranslationCredential({
        secret: modelApiKey,
        baseUrl: values.modelBaseUrl,
      });
      const nextCredentials = {
        ocrProvider: currentOcrProvider(),
        ocrCredentialRef,
        paddleToken: ocrToken,
        translationCredentialRef,
        modelApiKey,
      };
      credentialsStatePort.setCredentials?.(nextCredentials);
      // 统一走 savePersisted*：localStorage + 桌面 snapshot/IPC 一次写齐
      await savePersistedBrowserStoredConfig(nextCredentials);
      // 兼容旧注入（桌面 markConfigured / 任务选项）
      if (runtimeEnv.isDesktopMode() && saveDesktopConfig) {
        await persistDesktopCredentials({
          currentOcrProvider,
          defaultModelApiKey,
          defaultModelBaseUrl,
          saveTaskOptions: undefined,
          saveDesktopConfig,
          checkApiConnectivity: async () => {
            try {
              await checkApiConnectivity?.();
            } catch {
              /* ignore connectivity on save */
            }
          },
          values: {
            ...values,
            ocrCredentialRef,
            paddleToken: ocrToken,
            modelApiKey,
            translationCredentialRef,
          },
          setupModePort,
        });
      }
      saveTaskOptions?.(nextTaskOptions);
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

  async function handleBrowserCredentialSave() {
    if (credentialSaveInFlight) return;
    credentialSaveInFlight = true;
    viewPort.setDialogStatus("正在保存…", "");
    try {
      await performBrowserCredentialSave();
    } finally {
      credentialSaveInFlight = false;
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
    changeTranslationProvider: (providerId) => {
      captureCurrentTranslationProfile();
      applyTranslationProfile(`${providerId || "custom"}`);
      viewPort.setDeepSeekValidationMessage("", "");
      viewPort.setDeepSeekTopUpVisible(false);
      balanceState.resetDeepSeekBalance();
      onCredentialStateChange?.();
    },
  });

  // Resolve the backend-owned translation credential on mount. This also
  // repairs a missing local reference without ever returning the secret.
  const credentialReferencesReady = refreshCredentialReferences().catch(() => {
    // Keep startup non-blocking; save will surface actionable vault errors.
  });

  return {
    activateCredentialTab,
    ready: () => credentialReferencesReady,
    ensureOcrCredentialsReady,
    hasBrowserCredentials,
    hasOcrCredentials,
    openBrowserCredentialsDialog,
    prepareCredentialsPanels,
    refreshDeepSeekBalance,
    setDialogStatus: viewPort.setDialogStatus,
    updateCredentialGate,
  };
}
