// 凭据弹窗/设置面板的同步、开关与门禁。
//
// 负责把 credentialsStatePort 的凭据状态回填到对话框元素、切换凭据 tab、
// 打开/准备面板，以及计算上传门禁是否展示。全部通过注入的端口操作视图，
// 不直接触碰 DOM。

import { getOcrProviderDefinition, normalizeOcrProvider } from "@/platform/config/providers.js";
import { syncCredentialDialogFields } from "./dialog-sync.js";
import { ocrTokenFromCredentials } from "./state-selectors.js";
import type { ProviderChangeEvent, UpdateCredentialGateViewOptions } from "./view-contracts.js";
import type { CredentialsFields } from "./state.js";


export type UpdateCredentialGateOptions = {
  workflowNeedsCredentials: () => boolean;
  workflowNeedsUpload: () => boolean;
  hasCredentials?: () => boolean;
  refreshSubmitControls: () => void;
};

type DialogFlowElements = {
  dialog?: HTMLDialogElement | HTMLElement | boolean | null;
  apiKeyInput?: { value?: string } | null;
  modelBaseUrlInput?: { value?: string } | null;
  modelNameInput?: { value?: string } | null;
  translationWorkersInput?: { value?: string } | null;
  translationProtocolSelect?: { value?: string } | null;
  translationThinkingSelect?: { value?: string } | null;
  mathModeSelect?: { value?: string } | null;
};

type DialogFlowViewPort = {
  activateTab: (tabName?: string) => void;
  closeDialog: () => void;
  dialogElements: () => DialogFlowElements;
  setDeepSeekTopUpVisible: (visible?: boolean) => void;
  setDeepSeekValidationMessage: (message?: string, tone?: string) => void;
  setDialogMode: (options?: {
    setupMode?: boolean;
    activateCredentialTab?: (tabName?: string) => void;
  }) => void;
  setDialogStatus: (message?: string, tone?: string) => void;
  setHiddenOcrProvider: (providerId?: string) => void;
  setOcrValidationMessage: (message?: string, tone?: string, providerId?: string) => void;
  setTranslationProvider: (provider?: string) => void;
  syncOcrProviderControls: (providerId?: string) => void;
  updateCredentialGate: (options?: UpdateCredentialGateViewOptions) => boolean | void;
};

type TranslationProfileManager = {
  hydrate: (credentials?: Record<string, unknown>, taskOptions?: Record<string, unknown>) => void;
  captureCurrent: () => void;
  applyProfile: (providerId?: string) => void;
  getCurrentProvider: () => string;
  getCurrentProfile: () => Record<string, unknown>;
};

type CredentialAccess = {
  readCurrentCredentials: () => CredentialsFields;
  currentOcrProvider: () => string;
  hasBrowserCredentials: () => boolean;
};

export function createCredentialDialogFlow({
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
}: {
  viewPort: DialogFlowViewPort;
  credentialsStatePort: { patchCredentials?: (payload?: Record<string, unknown>) => unknown };
  getTaskOptions?: () => Record<string, unknown> | unknown;
  defaultModelBaseUrl?: () => string;
  defaultModelApiKey?: () => string;
  dialogElementsPort: {
    elements: () => DialogFlowElements;
    syncTranslationProvider?: (baseUrl?: string) => void;
    syncOcrProviderControls: (providerId?: string) => void;
  };
  balanceState: { resetDeepSeekBalance: () => unknown };
  translation: TranslationProfileManager;
  access: CredentialAccess;
  uploadState: { getSnapshot: () => { uploadId?: string } };
  runtimeEnv: { isDesktopMode: () => boolean };
  onCredentialStateChange?: () => void;
}) {
  function setCredentialDialogMode(setupMode = false) {
    viewPort.setDialogMode({ setupMode, activateCredentialTab });
  }

  function activateCredentialTab(tabName = "api") {
    viewPort.activateTab(tabName);
  }

  function syncOcrProviderControls(providerId = access.currentOcrProvider()) {
    const activeProvider = normalizeOcrProvider(providerId);
    viewPort.syncOcrProviderControls(activeProvider);
  }

  function readUploadState() {
    return uploadState.getSnapshot() || {};
  }

  function syncOcrCredentialFeedback() {
    const credentials = access.readCurrentCredentials();
    const definition = getOcrProviderDefinition(credentials.ocrProvider);
    viewPort.setOcrValidationMessage(
      ocrTokenFromCredentials(credentials) ? `${definition.label} Token 已保存在本机` : "",
      ocrTokenFromCredentials(credentials) ? "valid" : "",
      definition.id,
    );
  }

  function syncBrowserDialogFromCredentialState() {
    const credentials = access.readCurrentCredentials();
    const taskOptions = (getTaskOptions?.() || {}) as Record<string, unknown>;
    translation.hydrate(credentials as unknown as Record<string, unknown>, taskOptions);
    const profile = translation.getCurrentProfile();
    syncCredentialDialogFields({
      credentials: { ...credentials, modelApiKey: profile.apiKey },
      taskOptions: {
        ...taskOptions,
        baseUrl: profile.baseUrl,
        model: profile.model,
        workers: profile.workers,
        apiProtocol: profile.apiProtocol,
        thinking: profile.thinking,
      },
      defaultModelBaseUrl,
      defaultModelApiKey,
      elementsPort: dialogElementsPort,
    });
    viewPort.setTranslationProvider?.(translation.getCurrentProvider());
    syncOcrCredentialFeedback();
    viewPort.setDeepSeekValidationMessage("", "");
    if (profile.apiKey) {
      viewPort.setDeepSeekValidationMessage("翻译 API Key 已保存在本机", "valid");
    }
    viewPort.setDeepSeekTopUpVisible(false);
    balanceState.resetDeepSeekBalance();
    viewPort.setDialogStatus("", "");
  }

  /**
   * 设置面板内嵌模式（SettingsDialog 接口区）：只做"从凭据状态回填表单 +
   * 复位到 api tab"，不经 viewPort.openDialog()——表单宿主是设置面板本身，
   * 没有独立弹窗可开。
   *
   * setupMode 由设置弹窗的 payload 透传进来（和 tab 同一个来源）。首次配置门
   * 现在也开这一个弹窗，只是带上 setupMode：表单据此换成「保存并启动」、收起
   * AI Agent 卡片，保存时写 firstRunCompleted。此前它另有一个独立外壳，
   * 同一件事两套壳，用户看到的是两个长得不一样的「接口设置」。
   */
  function prepareCredentialsPanels({ setupMode = false }: { setupMode?: boolean } = {}) {
    syncBrowserDialogFromCredentialState();
    setCredentialDialogMode(setupMode);
    activateCredentialTab("api");
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
    const credentialsReady = hasCredentials?.() ?? access.hasBrowserCredentials();
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

  function handleOcrProviderChange(event: ProviderChangeEvent) {
    const provider = normalizeOcrProvider(event.currentTarget?.value);
    // A reference belongs to one provider. Clear it before the asynchronous lookup.
    if (provider !== access.currentOcrProvider()) {
      credentialsStatePort.patchCredentials?.({ ocrProvider: provider, ocrCredentialRef: "" });
    }
    viewPort.setHiddenOcrProvider(provider);
    syncOcrProviderControls(provider);
    syncOcrCredentialFeedback();
    onCredentialStateChange?.();
  }

  function handleTranslationProviderChange(providerId: string) {
    translation.captureCurrent?.();
    translation.applyProfile(`${providerId || "custom"}`);
    viewPort.setDeepSeekValidationMessage("", "");
    viewPort.setDeepSeekTopUpVisible(false);
    balanceState.resetDeepSeekBalance();
    onCredentialStateChange?.();
  }

  return {
    setCredentialDialogMode,
    activateCredentialTab,
    syncOcrProviderControls,
    syncOcrCredentialFeedback,
    syncBrowserDialogFromCredentialState,
    prepareCredentialsPanels,
    updateCredentialGate,
    handleOcrProviderChange,
    handleTranslationProviderChange,
  };
}
