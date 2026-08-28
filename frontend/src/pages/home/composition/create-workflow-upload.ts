// workflow + upload Tính năng。

import {
  API_PREFIX,
  apiBase,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultModelName,
  defaultOcrProvider,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  DEFAULT_FILE_LABEL,
  FRONT_MAX_BYTES,
  FRONT_MAX_PAGE_COUNT,
  getDeveloperConfig,
  resetDeveloperConfig,
  setDeveloperConfig,
  isDesktopMode,
  savePersistedDeveloperStoredConfig,
  mountUploadFeature,
  mountWorkflowFeature,
  defaultWorkflowConfigPort,
  countPdfPages,
  collectUploadFormData,
} from "./external.js";
import {
  normalizeMathMode,
  normalizeWorkflow,
  workflowConstants,
} from "../features/workflow/workflow-config.js";
import type {
  AsyncFn,
  CredentialsStatePort,
  HomeFeatures,
  UploadFeature,
  UploadStatePort,
  WorkflowFeature,
} from "./types.js";

type WorkflowViewPort = {
  selectedGlossaryId: () => string;
  viewPort: unknown;
};

type UploadViewPort = {
  viewPort: unknown;
  setUploadProgress: (loaded: number, total: number) => void;
  clearFileInputValue: () => void;
};

type CreateWorkflowAndUploadArgs = {
  features: HomeFeatures;
  credentialsStatePort: CredentialsStatePort;
  workflowView: WorkflowViewPort;
  uploadView: UploadViewPort;
  uploadStatePort: UploadStatePort;
  bridge: { resetUploadedFile: () => void; resetUploadProgress: () => void };
  legacyState: Record<string, unknown>;
  setText: (id: string, value?: string) => void;
  fetchGlossaries: AsyncFn;
  submitUploadRequest: AsyncFn;
};

export function createWorkflowAndUpload({
  features,
  credentialsStatePort,
  workflowView,
  uploadView,
  uploadStatePort,
  bridge,
  legacyState,
  setText,
  fetchGlossaries,
  submitUploadRequest,
}: CreateWorkflowAndUploadArgs): {
  workflowFeature: WorkflowFeature;
  uploadFeature: UploadFeature;
} {
  const constants = workflowConstants();

  function readSubmitValues({
    defaultOcrProvider: ocrProviderFallback,
    defaultPaddleToken: paddleTokenFallback,
    defaultModelApiKey: modelApiKeyFallback,
  }: {
    defaultOcrProvider?: string;
    defaultPaddleToken?: string;
    defaultModelApiKey?: string;
  } = {}) {
    const credentials = credentialsStatePort.getCredentials();
    const ocrProvider = credentials?.ocrProvider || ocrProviderFallback;
    // providerId Thẻ trong suốt chỉ dành cho các cuộc gọi lịch sử；getOcrToken Nhận biết chế độ chỉ đọc defaultPaddleToken。
    const ocrToken = credentialsStatePort.getOcrToken({
      defaultPaddleToken: () => paddleTokenFallback || "",
    }) || "";
    return {
      ocrProvider,
      ocrToken,
      modelApiKey: credentials?.modelApiKey || modelApiKeyFallback,
      selectedGlossaryId: workflowView.selectedGlossaryId(),
    };
  }

  const workflowFeature = mountWorkflowFeature({
    configPort: defaultWorkflowConfigPort,
    saveDeveloperStoredConfig: savePersistedDeveloperStoredConfig,
    getDeepSeekBalanceState: () => credentialsStatePort.getDeepSeekBalanceState(),
    getDeveloperConfig: () => getDeveloperConfig(legacyState),
    getUploadState: uploadStatePort.getSnapshot,
    isDesktopMode: () => isDesktopMode(legacyState),
    resetDeveloperConfig: () => resetDeveloperConfig(legacyState),
    setDeveloperConfig: (config: Record<string, unknown>) => setDeveloperConfig(legacyState, config),
    defaultModelName,
    defaultModelBaseUrl,
    defaultPaddleApiUrl,
    defaultPaddleToken,
    defaultOcrProvider,
    defaultModelApiKey,
    defaultFileLabel: DEFAULT_FILE_LABEL,
    normalizeWorkflow,
    normalizeMathMode,
    constants,
    currentPageRanges: () => features.uploadFeature.currentPageRanges() || "",
    viewPort: workflowView.viewPort as import("../../../js/features/workflow/controller.js").WorkflowViewPortLike,
    readSubmitValues,
    renderPageRangeSummary: () => features.uploadFeature.renderPageRangeSummary(),
    hasBrowserCredentials: () => Boolean(features.browserCredentialsFeature.hasBrowserCredentials()),
    updateCredentialGate: (options?: unknown) => features.browserCredentialsFeature.updateCredentialGate(options),
    fetchGlossaries,
    apiPrefix: API_PREFIX,
    setText,
  }) as WorkflowFeature;

  // mountUploadFeature Yêu cầu chữ ký state，nhưng uploadStatePort Đủ trong thời gian chạy；Cấp thấp hơn nocheck Chữ ký không được nới lỏng。
  const uploadFeature = mountUploadFeature({
    uploadStatePort,
    viewPort: uploadView.viewPort as import("../../../js/features/upload/controller.js").UploadViewPort,
    apiBase: typeof apiBase === "function" ? apiBase() : apiBase,
    apiPrefix: API_PREFIX,
    frontMaxBytes: FRONT_MAX_BYTES,
    frontMaxPageCount: FRONT_MAX_PAGE_COUNT,
    countPdfPages,
    defaultFileLabel: DEFAULT_FILE_LABEL,
    collectUploadFormData,
    submitUploadRequest: submitUploadRequest as import("../../../js/features/upload/controller.js").MountUploadFeatureOptions["submitUploadRequest"],
    resetUploadedFile: bridge.resetUploadedFile,
    resetUploadProgress: bridge.resetUploadProgress,
    setUploadProgress: uploadView.setUploadProgress,
    clearFileInputValue: uploadView.clearFileInputValue,
    setText,
    applyWorkflowMode: () => workflowFeature.applyWorkflowMode(),
    refreshSubmitControls: () => workflowFeature.refreshSubmitControls(),
    refreshDeepSeekBalance: null,
    workflowNeedsUpload: (workflow?: string) => workflowFeature.workflowNeedsUpload(workflow),
  }) as UploadFeature;

  return { workflowFeature, uploadFeature };
}
