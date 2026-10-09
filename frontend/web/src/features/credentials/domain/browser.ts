import type {
  CreateCredentialInput,
  CredentialMutationView,
  UpdateCredentialInput,
} from "@/platform/api/domains/credentials.js";
import { dialogDataset } from "./translation-profile.js";
import {
  defaultCredentialsStatePort,
} from "./default-state-port.js";
import { createCredentialRuntimeEnvPort } from "./runtime-env-port.js";
import { createCredentialUploadReadinessPort } from "./upload-readiness-port.js";
import type { UploadReadinessSource } from "./upload-readiness-port.js";
import { createCredentialAccess } from "./credential-access.js";
import { createTranslationProfiles } from "./translation-profiles.js";
import { createCredentialDialogFlow } from "./dialog-flow.js";
import { createBrowserCredentialSaveFlow } from "./save-flow.js";
import { createCredentialValidationFlow } from "./validation-flow.js";
import type {
  ProviderValidationResult,
} from "./validation.js";
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
  mineruInput?: HTMLInputElement | null;
  apiKeyInput?: HTMLInputElement | null;
  modelBaseUrlInput?: HTMLInputElement | null;
  modelNameInput?: HTMLInputElement | null;
  translationWorkersInput?: HTMLInputElement | null;
  translationProtocolSelect?: HTMLSelectElement | null;
  translationThinkingSelect?: HTMLSelectElement | null;
  mathModeSelect?: HTMLSelectElement | null;
}

export interface CredentialDialogElementsPort {
  elements: () => CredentialDialogElements;
  syncOcrProviderControls: (providerId?: string) => void;
  syncTranslationProvider?: (baseUrl?: string) => void;
}

export interface CredentialsViewPort {
  activateTab: (tabName?: string) => void;
  bindEvents: (handlers: BindCredentialViewEventsOptions) => void;
  closeDialog: () => void;
  dialogElements: () => CredentialDialogElements;
  setDeepSeekTopUpVisible: (visible?: boolean) => void;
  setTranslationProvider: (provider?: string) => void;
  setDeepSeekValidationMessage: (message?: string, tone?: string) => void;
  setDialogMode: (options?: {
    setupMode?: boolean;
    activateCredentialTab?: (tabName?: string) => void;
  }) => void;
  setDialogStatus: (message?: string, tone?: string) => void;
  setHiddenOcrProvider: (providerId?: string) => void;
  setOcrValidationMessage: (message?: string, tone?: string, providerId?: string) => void;
  syncOcrProviderControls: (providerId?: string) => void;
  updateCredentialGate: (options?: UpdateCredentialGateViewOptions) => boolean | void;
}

export interface CredentialsRuntimeEnvPort {
  isDesktopMode: () => boolean;
}

export interface CredentialsUploadStatePort {
  getSnapshot: () => {
    uploadId?: string;
  };
}

export interface CredentialsBalanceStatePort {
  resetDeepSeekBalance: () => void;
}

export interface CredentialsSetupModePort {
  currentSetupMode: () => boolean;
}

export interface DeepSeekViewPort {
  elements: () => CredentialDialogElements;
  setTopUpVisible: (visible?: boolean) => void;
  setValidationMessage: (message?: string, tone?: string) => void;
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
  apiPrefix: string;
  state?: unknown;
  applyHiddenCredentialInputs?: (credentials?: Partial<CredentialsFields>) => unknown;
  defaultPaddleToken?: () => string;
  defaultModelApiKey?: () => string;
  defaultModelBaseUrl?: () => string;
  getTaskOptions?: () => Record<string, unknown> | unknown;
  saveTaskOptions?: (options?: Record<string, unknown>) => unknown;
  saveBrowserStoredConfig?: (credentials?: Partial<CredentialsFields>) => unknown;
  readHiddenCredentialInputs?: () => CredentialsFields | Record<string, unknown> | unknown;
  saveDesktopConfig?: (
    browserConfig?: Record<string, unknown>,
    afterSave?: () => unknown,
  ) => Promise<unknown> | unknown;
  checkApiConnectivity?: () => Promise<unknown> | unknown;
  validateOcrToken: (
    apiPrefix: string,
    providerId: string,
    token: string,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  validateDeepSeekToken: (
    apiPrefix: string,
    payload: Record<string, unknown>,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  queryDeepSeekBalance?: (
    apiPrefix: string,
    payload: Record<string, unknown>,
  ) => Promise<ProviderValidationResult | unknown> | ProviderValidationResult | unknown;
  // 挂载层只透传、不读取返回值，故返回值保持 unknown。
  createCredential?: (apiPrefix: string | undefined, payload: CreateCredentialInput) => Promise<CredentialMutationView>;
  updateCredential?: (
    apiPrefix: string | undefined,
    credentialRef: string,
    payload: UpdateCredentialInput,
  ) => Promise<CredentialMutationView>;
  onCredentialStateChange?: () => void;
  uploadStatePort?: CredentialsUploadStatePort;
  credentialsStatePort?: CredentialsStatePort;
  runtimeEnvPort?: CredentialsRuntimeEnvPort;
  balanceStatePort?: CredentialsBalanceStatePort;
  legacyRuntimePort?: unknown;
  legacyValidationCachePort?: unknown;
  viewPort: CredentialsViewPort;
  dialogElementsPort: CredentialDialogElementsPort;
  deepSeekViewPort?: DeepSeekViewPort;
  setupModePort?: CredentialsSetupModePort;
}

/**
 * 装配根：把显式注入的端口接成 wires（access / translation / dialog / vault /
 * save / validation），对外只返回稳定的挂载句柄。所有可抽出的逻辑都在同目录
 * 的聚焦模块里。
 */
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
  // state 是调用方传入的宿主态（unknown），这里按上传门禁需要的字段切片读取。
  const uploadState = uploadStatePort || createCredentialUploadReadinessPort(state as UploadReadinessSource);
  const runtimeEnv = runtimeEnvPort || createCredentialRuntimeEnvPort(state);
  const balanceState = balanceStatePort || {
    resetDeepSeekBalance: () => credentialsStatePort.resetDeepSeekBalance?.(),
  };

  const access = createCredentialAccess({ credentialsStatePort, defaultPaddleToken });

  const translation = createTranslationProfiles({
    dialogElementsPort,
    setTranslationProvider: viewPort.setTranslationProvider,
  });

  const dialogFlow = createCredentialDialogFlow({
    viewPort,
    credentialsStatePort,
    getTaskOptions,
    defaultModelBaseUrl,
    defaultModelApiKey,
    dialogElementsPort,
    balanceState,
    translation,
    access,
    uploadState,
    runtimeEnv,
    onCredentialStateChange,
  });

  const saveFlow = createBrowserCredentialSaveFlow({
    viewPort,
    credentialsStatePort,
    access,
    translation,
    getTaskOptions,
    defaultModelBaseUrl,
    defaultModelApiKey,
    saveTaskOptions,
    saveDesktopConfig,
    checkApiConnectivity,
    setupModePort,
    onCredentialStateChange,
    dialogElementsPort,
    syncBrowserDialogFromCredentialState: dialogFlow.syncBrowserDialogFromCredentialState,
    runtimeEnv,
  });

  const validation = createCredentialValidationFlow({
    apiPrefix,
    state,
    viewPort,
    deepSeekViewPort,
    access,
    dialogElementsPort,
    validateOcrToken,
    validateDeepSeekToken,
    queryDeepSeekBalance,
    defaultPaddleToken,
    defaultModelApiKey,
    onCredentialStateChange,
    credentialsStatePort,
    runtimeEnv,
    legacyRuntimePort,
    legacyValidationCachePort,
  });

  viewPort.bindEvents({
    resetOcrValidation: () => {
      credentialsStatePort.resetOcrValidationCache?.();
      viewPort.setOcrValidationMessage("", "", access.currentOcrProvider());
    },
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
    validateOcr: validation.handleOcrValidate,
    validateDeepSeek: validation.handleDeepSeekValidate,
    save: saveFlow.handleSave,
    activateCredentialTab: dialogFlow.activateCredentialTab,
    changeProvider: (event) => {
      if (saveFlow.isSaving()) return;
      dialogFlow.handleOcrProviderChange(event);
      credentialsStatePort.resetOcrValidationCache?.();
      onCredentialStateChange?.();
    },
    changeTranslationProvider: dialogFlow.handleTranslationProviderChange,
  });

  // 凭据只住在这个浏览器里，一个字节都不向服务端要。
  //
  // 这里曾经先跑 restoreLocalCredentialValues：用 ?include_values=true 把服务端
  // vault 里的明文拉回来，填进输入框并写进 localStorage。它的本意写在那个文件
  // 头上——「老版本迁移兼容，新的保存都是本地的」——但实现是每个新浏览器都无条件
  // 跑一遍，而不是迁一次。加上 vault 会被任务提交路径不断重新填满（后端
  // secure_job_credentials 在任务落库前把内联 key 换成引用，好让明文不进 jobs
  // 表），那条「兼容」永远不会变成空操作，于是成了服务端↔浏览器的永久往返：
  // 换一个无痕窗口、甚至换一台机器打开，照样显示出你的 MinerU Token。
  //
  // 现在只用本机已有的凭据回填输入框。vault 仍然存在，但退回成任务执行的内部
  // 实现细节，不再是 UI 的数据源。代价是清掉浏览器数据 = Key 需要重新填。
  const credentialReferencesReady = Promise.resolve().then(() => {
    const current = access.readCurrentCredentials();
    const elements = dialogElementsPort.elements();
    for (const [input, value] of [
      [elements.paddleInput, current.paddleToken],
      [elements.mineruInput, current.mineruToken],
      [elements.apiKeyInput, current.modelApiKey],
    ] as const) {
      if (input && !input.value) input.value = value || "";
    }
    onCredentialStateChange?.();
  }).catch(() => {
    // Local config remains usable offline; existing keys are never erased.
  });

  return {
    activateCredentialTab: dialogFlow.activateCredentialTab,
    ready: () => credentialReferencesReady,
    ensureOcrCredentialsReady: validation.ensureOcrReady,
    hasBrowserCredentials: access.hasBrowserCredentials,
    hasOcrCredentials: access.hasOcrCredentials,
    prepareCredentialsPanels: dialogFlow.prepareCredentialsPanels,
    refreshDeepSeekBalance: validation.refreshDeepSeekBalance,
    setDialogStatus: viewPort.setDialogStatus,
    updateCredentialGate: dialogFlow.updateCredentialGate,
  };
}
