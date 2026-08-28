import {
  buildDeveloperConfigWithDefaults,
  workflowHeadline as resolveWorkflowHeadline,
  workflowNeedsCredentials as resolveWorkflowNeedsCredentials,
  workflowNeedsUpload as resolveWorkflowNeedsUpload,
  workflowSubmitLabel as resolveWorkflowSubmitLabel,
  workflowUsesRenderStage as resolveWorkflowUsesRenderStage,
} from "./rules.js";
import {
  buildOcrPayload as buildOcrPayloadRequest,
  buildRenderPayload as buildRenderPayloadRequest,
  buildSourcePayload as buildSourcePayloadRequest,
  buildTranslationPayload as buildTranslationPayloadRequest,
  type WorkflowDeveloperConfig,
  type WorkflowPayloadConstants,
} from "./payload.js";
import { createGlossaryOptionsLoader } from "./glossary-options.js";
import {
  buildDeveloperConfigFromDialog,
  defaultDeveloperDialogReadOptions,
} from "./developer-dialog.js";
import { resolveSubmitControlState } from "./submit-controls.js";
import { resolveTranslationBudgetState } from "./budget.js";
import { defaultWorkflowConfigPort } from "./config-port.js";

export interface WorkflowSubmitValues {
  ocrProvider?: string;
  ocrToken?: string;
  modelApiKey?: string;
  selectedGlossaryId?: string;
}

export interface LoadGlossaryOptionsParams {
  force?: boolean;
  selectedId?: string;
}

export interface WorkflowConfigPortLike {
  isMock: () => boolean;
  mockScenario: () => string;
}

export interface WorkflowViewPortLike {
  setDeveloperGlossaryOptions: (glossaries?: unknown[], selectedId?: string) => void;
  setDeveloperDialog: (config: unknown) => void;
  readDeveloperWorkflow: () => string;
  setDeveloperWorkflowFormState: (state: {
    workflow: string;
    workflowRender: string;
    workflowTranslate: string;
  }) => void;
  renderBudgetNote: (budget: unknown) => void;
  setSubmitControls: (state: unknown) => void;
  applyMockUpload: (options: {
    mockScenario?: string;
    submitLabel?: string;
    showPageRangeButton?: boolean;
  }) => void;
  applyWorkflowUpload: (options: {
    needsUpload?: boolean;
    uploadReady?: boolean;
    defaultFileLabel?: string;
    headline?: string;
    renderSourceJobId?: string;
  }) => void;
  readDeveloperDialog: (options?: unknown) => unknown;
  closeDeveloperDialog: () => void;
  readSubmitValues?: (options?: {
    defaultOcrProvider?: string;
    defaultPaddleToken?: string;
    defaultModelApiKey?: string;
  }) => WorkflowSubmitValues;
}

export interface WorkflowConstants extends WorkflowPayloadConstants {
  DEFAULT_WORKERS: number;
  DEFAULT_BATCH_SIZE: number;
  DEFAULT_CLASSIFY_BATCH_SIZE: number;
  DEFAULT_COMPILE_WORKERS: number;
  DEFAULT_TIMEOUT_SECONDS: number;
  WORKFLOW_BOOK: string;
  WORKFLOW_TRANSLATE: string;
  WORKFLOW_RENDER: string;
}

export interface MountWorkflowFeatureOptions {
  configPort?: WorkflowConfigPortLike;
  saveDeveloperStoredConfig: (config?: unknown) => unknown;
  getDeepSeekBalanceState: () => {
    balanceCny?: number | null;
    balanceChecked?: boolean;
  };
  getDeveloperConfig: () => WorkflowDeveloperConfig | Record<string, unknown> | null | undefined;
  getUploadState: () => {
    uploadId?: string;
    uploadedPageCount?: number;
  };
  isDesktopMode: () => boolean;
  resetDeveloperConfig: () => void;
  setDeveloperConfig: (config: unknown) => void;
  defaultModelName: () => string;
  defaultModelBaseUrl: () => string;
  defaultPaddleApiUrl: () => string;
  defaultPaddleToken: () => string;
  defaultOcrProvider: () => string;
  defaultModelApiKey: () => string;
  defaultFileLabel?: string;
  normalizeWorkflow: (value?: unknown) => string;
  normalizeMathMode: (value?: unknown) => string;
  constants: WorkflowConstants;
  currentPageRanges: () => string;
  viewPort: WorkflowViewPortLike;
  readSubmitValues?: WorkflowViewPortLike["readSubmitValues"];
  renderPageRangeSummary: () => void;
  hasBrowserCredentials?: () => boolean;
  updateCredentialGate?: (options?: {
    workflowNeedsCredentials?: () => boolean;
    workflowNeedsUpload?: () => boolean;
    refreshSubmitControls?: () => void;
  }) => void;
  fetchGlossaries?: (apiPrefix?: string) => Promise<{ items?: unknown[] } | unknown>;
  apiPrefix?: string;
  setText?: (id: string, value?: string) => void;
}

export interface WorkflowRunPayload {
  workflow: string;
  source: unknown;
  runtime: {
    job_id: string;
    timeout_seconds: number | undefined;
  };
  ocr?: unknown;
  translation?: unknown;
  render?: unknown;
}

export function mountWorkflowFeature({
  configPort = defaultWorkflowConfigPort,
  saveDeveloperStoredConfig,
  getDeepSeekBalanceState,
  getDeveloperConfig,
  getUploadState,
  isDesktopMode,
  resetDeveloperConfig,
  setDeveloperConfig,
  defaultModelName,
  defaultModelBaseUrl,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  defaultOcrProvider,
  defaultModelApiKey,
  defaultFileLabel = "Chọn PDF",
  normalizeWorkflow,
  normalizeMathMode,
  constants,
  currentPageRanges,
  viewPort,
  readSubmitValues = viewPort.readSubmitValues,
  renderPageRangeSummary,
  hasBrowserCredentials,
  updateCredentialGate: updateCredentialGatePort,
  fetchGlossaries,
  apiPrefix,
  setText,
}: MountWorkflowFeatureOptions) {
  const {
    DEFAULT_WORKERS,
    DEFAULT_BATCH_SIZE,
    DEFAULT_CLASSIFY_BATCH_SIZE,
    DEFAULT_COMPILE_WORKERS,
    DEFAULT_TIMEOUT_SECONDS,
    WORKFLOW_BOOK,
    WORKFLOW_TRANSLATE,
    WORKFLOW_RENDER,
  } = constants;

  let refreshSubmitControlsRef = null;
  let applyWorkflowModeRef = null;
  const glossaryOptionsLoader = createGlossaryOptionsLoader({
    fetchGlossaries,
    apiPrefix,
    setDeveloperGlossaryOptions: viewPort.setDeveloperGlossaryOptions,
    setText,
    getDefaultSelectedId: () => developerConfigWithDefaults().glossaryId,
  });

  function developerConfigWithDefaults() {
    return buildDeveloperConfigWithDefaults({
      saved: getDeveloperConfig(),
      normalizeWorkflow,
      normalizeMathMode,
      defaults: {
        workers: DEFAULT_WORKERS,
        batchSize: DEFAULT_BATCH_SIZE,
        classifyBatchSize: DEFAULT_CLASSIFY_BATCH_SIZE,
        compileWorkers: DEFAULT_COMPILE_WORKERS,
        timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      },
      defaultModelName,
      defaultModelBaseUrl,
    });
  }

  function syncDeveloperDialogFromState() {
    const config = developerConfigWithDefaults();
    glossaryOptionsLoader.applyOptions(config.glossaryId);
    viewPort.setDeveloperDialog(config);
    updateDeveloperWorkflowFormState();
    void loadGlossaryOptions();
  }

  function currentWorkflow() {
    return developerConfigWithDefaults().workflow;
  }

  function currentRenderSourceJobId() {
    return developerConfigWithDefaults().renderSourceJobId;
  }

  function workflowNeedsUpload(workflow = currentWorkflow()) {
    return resolveWorkflowNeedsUpload(workflow, constants);
  }

  function workflowNeedsCredentials(workflow = currentWorkflow()) {
    return resolveWorkflowNeedsCredentials(workflow, constants);
  }

  function workflowUsesRenderStage(workflow = currentWorkflow()) {
    return resolveWorkflowUsesRenderStage(workflow, constants);
  }

  function workflowSubmitLabel(workflow = currentWorkflow()) {
    return resolveWorkflowSubmitLabel(workflow, constants);
  }

  function workflowUsesTranslation(workflow = currentWorkflow()) {
    return workflow === WORKFLOW_BOOK || workflow === WORKFLOW_TRANSLATE;
  }

  function workflowHeadline(workflow = currentWorkflow()) {
    return resolveWorkflowHeadline(workflow, constants);
  }

  function updateDeveloperWorkflowFormState() {
    const workflow = normalizeWorkflow(viewPort.readDeveloperWorkflow());
    viewPort.setDeveloperWorkflowFormState({
      workflow,
      workflowRender: WORKFLOW_RENDER,
      workflowTranslate: WORKFLOW_TRANSLATE,
    });
  }

  function refreshSubmitControls() {
    const workflow = currentWorkflow();
    const uploadState = getUploadState();
    const budget = currentBudgetState(workflow);
    const submitState = resolveSubmitControlState({
      workflow,
      isMock: configPort.isMock(),
      desktopMode: isDesktopMode(),
      uploadId: uploadState.uploadId,
      renderSourceJobId: currentRenderSourceJobId(),
      hasBrowserCredentials: Boolean(hasBrowserCredentials?.()),
      budgetBlocking: budget.blocking,
      workflowNeedsUpload,
      workflowNeedsCredentials,
      workflowSubmitLabel,
    });
    viewPort.renderBudgetNote(budget);
    viewPort.setSubmitControls(submitState);
  }

  function currentBudgetState(workflow = currentWorkflow()) {
    const uploadState = getUploadState();
    const balanceState = getDeepSeekBalanceState();
    return resolveTranslationBudgetState({
      pageRanges: currentPageRanges(),
      uploadedPageCount: uploadState.uploadedPageCount,
      balanceCny: balanceState.balanceCny,
      balanceChecked: balanceState.balanceChecked,
      needsTranslation: workflowNeedsUpload(workflow) && workflowUsesTranslation(workflow) && Boolean(uploadState.uploadId),
    });
  }

  function updateCredentialGate() {
    if (configPort.isMock()) {
      return;
    }
    updateCredentialGatePort?.({
      workflowNeedsCredentials: () => workflowNeedsCredentials(currentWorkflow()),
      workflowNeedsUpload: () => workflowNeedsUpload(currentWorkflow()),
      refreshSubmitControls,
    });
  }

  function applyWorkflowMode() {
    const workflow = currentWorkflow();
    const needsUpload = workflowNeedsUpload(workflow);
    const showPageRangeButton = workflowNeedsUpload(workflow);
    if (configPort.isMock()) {
      viewPort.applyMockUpload({
        mockScenario: configPort.mockScenario(),
        submitLabel: workflowSubmitLabel(workflow),
        showPageRangeButton,
      });
      renderPageRangeSummary();
      updateCredentialGate();
      return;
    }
    const uploadState = getUploadState();
    viewPort.applyWorkflowUpload({
      needsUpload,
      uploadReady: Boolean(uploadState.uploadId),
      defaultFileLabel,
      headline: workflowHeadline(workflow),
      renderSourceJobId: currentRenderSourceJobId(),
    });
    renderPageRangeSummary();
    refreshSubmitControls();
    updateCredentialGate();
    void loadGlossaryOptions();
  }

  function saveDeveloperDialog() {
    const currentConfig = developerConfigWithDefaults();
    const values = viewPort.readDeveloperDialog(defaultDeveloperDialogReadOptions({
      defaultModelName,
      defaultModelBaseUrl,
      defaults: {
        workers: DEFAULT_WORKERS,
        batchSize: DEFAULT_BATCH_SIZE,
        classifyBatchSize: DEFAULT_CLASSIFY_BATCH_SIZE,
        compileWorkers: DEFAULT_COMPILE_WORKERS,
        timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      },
    }));
    setDeveloperConfig(buildDeveloperConfigFromDialog({
      currentConfig,
      values,
      normalizeWorkflow,
    }));
    viewPort.setDeveloperDialog(developerConfigWithDefaults());
    void saveDeveloperStoredConfig(getDeveloperConfig());
    applyWorkflowMode();
    viewPort.closeDeveloperDialog();
  }

  function resetDeveloperDialog() {
    resetDeveloperConfig();
    void saveDeveloperStoredConfig({});
    syncDeveloperDialogFromState();
    applyWorkflowMode();
  }

  function currentWorkflowSubmitValues(): WorkflowSubmitValues {
    return readSubmitValues?.({
      defaultOcrProvider: defaultOcrProvider(),
      defaultPaddleToken: defaultPaddleToken(),
      defaultModelApiKey: defaultModelApiKey(),
    }) || {};
  }

  function buildOcrPayload(pageRanges, submitValues: WorkflowSubmitValues = currentWorkflowSubmitValues()) {
    return buildOcrPayloadRequest({
      pageRanges,
      ocrProvider: submitValues.ocrProvider,
      ocrToken: submitValues.ocrToken,
      defaultPaddleApiUrl,
      constants,
    });
  }

  function buildTranslationPayload(
    developerConfig: WorkflowDeveloperConfig,
    submitValues: WorkflowSubmitValues = currentWorkflowSubmitValues(),
  ) {
    return buildTranslationPayloadRequest({
      developerConfig,
      modelApiKey: submitValues.modelApiKey,
      selectedGlossaryId: submitValues.selectedGlossaryId,
      constants,
    });
  }

  async function loadGlossaryOptions({ force = false, selectedId = "" }: LoadGlossaryOptionsParams = {}) {
    return glossaryOptionsLoader.loadGlossaryOptions({ force, selectedId });
  }

  function buildRenderPayload(developerConfig: WorkflowDeveloperConfig) {
    return buildRenderPayloadRequest({
      developerConfig,
      constants,
    });
  }

  // Tài liệu trong kho "Dịch toàn bộ/Trang đã chọn" (F5) tái sử dụng việc lắp ráp thông tin xác thực của luồng chính: từ các
  // thông tin xác thực đã cấu hình (credentialsStatePort, không liên quan đến việc dialog có mở hay không — readSubmitValues đọc
  // credentials state chứ không đọc DOM popup) lắp ra ocr(PaddleOCR) + translation(DeepSeek).
  // Không bao gồm source — backend sẽ inject upload_id từ upload đã lưu của tài liệu. pageRanges mặc định
  // chuỗi rỗng = toàn bộ.
  function buildTranslateJobConfig(pageRanges = "") {
    const developerConfig = developerConfigWithDefaults();
    const submitValues = currentWorkflowSubmitValues();
    return {
      ocr: buildOcrPayload(pageRanges, submitValues),
      translation: buildTranslationPayload(developerConfig, submitValues),
    };
  }

  function collectRunPayload(): WorkflowRunPayload {
    const pageRanges = currentPageRanges();
    const developerConfig = developerConfigWithDefaults();
    const workflow = developerConfig.workflow;
    const uploadState = getUploadState();
    const submitValues = currentWorkflowSubmitValues();
    const payload: WorkflowRunPayload = {
      workflow,
      source: buildSourcePayloadRequest({
        workflow,
        developerConfig,
        uploadId: uploadState.uploadId,
        workflowNeedsUpload,
      }),
      runtime: {
        job_id: "",
        timeout_seconds: developerConfig.timeoutSeconds,
      },
    };
    if (workflow === WORKFLOW_BOOK || workflow === WORKFLOW_TRANSLATE) {
      payload.ocr = buildOcrPayload(pageRanges, submitValues);
      payload.translation = buildTranslationPayload(developerConfig, submitValues);
    }
    if (workflowUsesRenderStage(workflow)) {
      payload.render = buildRenderPayload(developerConfig);
    }
    return payload;
  }

  return {
    applyWorkflowMode,
    buildTranslateJobConfig,
    collectRunPayload,
    currentRenderSourceJobId,
    currentWorkflow,
    currentBudgetState,
    developerConfigWithDefaults,
    loadGlossaryOptions,
    refreshSubmitControls,
    resetDeveloperDialog,
    saveDeveloperDialog,
    syncDeveloperDialogFromState,
    updateCredentialGate,
    updateDeveloperWorkflowFormState,
    workflowNeedsCredentials,
    workflowNeedsUpload,
  };
}
