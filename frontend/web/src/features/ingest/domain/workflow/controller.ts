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
import { isOfficialDeepSeekBaseUrl } from "@/platform/config/providers.js";

export interface WorkflowSubmitValues {
  ocrProvider?: string;
  ocrCredentialRef?: string;
  ocrToken?: string;
  translationCredentialRef?: string;
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
  WORKFLOW_OCR?: string;
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
    hasCredentials?: () => boolean;
    refreshSubmitControls?: () => void;
  }) => void;
  fetchGlossaries?: (apiPrefix?: string) => Promise<{ items?: unknown[] } | unknown>;
  apiPrefix?: string;
  setText?: (id: string, value?: string) => void;
  isOcrOnly?: () => boolean;
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
  defaultFileLabel = "选择 PDF",
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
  isOcrOnly,
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
  const WORKFLOW_OCR = (constants as any).WORKFLOW_OCR || "ocr";

  function isOcrOnlyMode() {
    return Boolean(isOcrOnly?.());
  }

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
    if (isOcrOnlyMode()) return "仅做 OCR";
    return resolveWorkflowSubmitLabel(workflow, constants);
  }

  function workflowUsesTranslation(workflow = currentWorkflow()) {
    if (isOcrOnlyMode()) return false;
    return workflow === WORKFLOW_BOOK || workflow === WORKFLOW_TRANSLATE;
  }

  function workflowHeadline(workflow = currentWorkflow()) {
    // 上传区只解释“先选择文件”这一步。当前处理模式已经由上方的
    // 分段控件明确表达，不在这里重复切换一段长短不同的说明，避免
    // 翻译 / OCR 切换时上传卡和外层 Dialog 一起发生高度抖动。
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
    const workflow = isOcrOnlyMode() ? WORKFLOW_OCR : currentWorkflow();
    const uploadState = getUploadState();
    const budget = currentBudgetState(workflow);
    const hasCreds = hasBrowserCredentials?.();
    const submitState = resolveSubmitControlState({
      workflow,
      isMock: configPort.isMock(),
      desktopMode: isDesktopMode(),
      uploadId: uploadState.uploadId,
      renderSourceJobId: currentRenderSourceJobId(),
      hasBrowserCredentials: Boolean(hasCreds),
      budgetBlocking: Boolean(budget.blocking),
      workflowNeedsUpload,
      workflowNeedsCredentials,
      workflowSubmitLabel,
    });
    // OCR-only 隐藏翻译预算提示
    if (isOcrOnlyMode()) {
      viewPort.renderBudgetNote({ visible: false, blocking: false, message: "", tone: "", topUpUrl: "" });
    } else {
      viewPort.renderBudgetNote(budget);
    }
    viewPort.setSubmitControls(submitState);
  }

  function currentBudgetState(workflow = currentWorkflow()) {
    if (isOcrOnlyMode()) {
      return { visible: false, blocking: false, tone: "", message: "", topUpUrl: "" } as any;
    }
    const developerConfig = getDeveloperConfig() || {};
    const modelBaseUrl = `${
      (developerConfig as { baseUrl?: unknown }).baseUrl
      || defaultModelBaseUrl()
      || ""
    }`;
    if (!isOfficialDeepSeekBaseUrl(modelBaseUrl)) {
      return { visible: false, blocking: false, tone: "", message: "", topUpUrl: "" } as any;
    }
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
    const workflow = isOcrOnlyMode() ? WORKFLOW_OCR : currentWorkflow();
    updateCredentialGatePort?.({
      workflowNeedsCredentials: () => workflowNeedsCredentials(workflow),
      workflowNeedsUpload: () => workflowNeedsUpload(workflow),
      hasCredentials: () => Boolean(hasBrowserCredentials?.()),
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
      ocrCredentialRef: submitValues.ocrCredentialRef,
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
      translationCredentialRef: submitValues.translationCredentialRef,
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

  // 馆藏文档"翻译整本/选定页码"(F5)复用主流程的凭据组装:从当前已配置的
  // 凭据(credentialsStatePort,与对话框是否打开无关——readSubmitValues 读的是
  // 凭据 state 而非弹窗 DOM)拼出 ocr(PaddleOCR)+ translation(DeepSeek)。
  // 不含 source——后端会从文档已存的 upload 注入 upload_id。pageRanges 缺省
  // 空串=整本。
  function buildTranslateJobConfig(pageRanges = "") {
    const developerConfig = developerConfigWithDefaults();
    const submitValues = currentWorkflowSubmitValues();
    if (isOcrOnlyMode()) {
      return {
        ocr: buildOcrPayload(pageRanges, submitValues),
      };
    }
    return {
      ocr: buildOcrPayload(pageRanges, submitValues),
      translation: buildTranslationPayload(developerConfig, submitValues),
    };
  }

  // 馆藏文档 OCR-only：只复用 OCR 凭据，不携带翻译模型配置。
  // source.upload_id 由文档级后端接口安全注入。
  function buildOcrJobConfig(pageRanges = "") {
    return {
      workflow: WORKFLOW_OCR,
      ocr: buildOcrPayload(pageRanges, currentWorkflowSubmitValues()),
    };
  }

  function collectRunPayload(): WorkflowRunPayload {
    const pageRanges = currentPageRanges();
    const developerConfig = developerConfigWithDefaults();
    const ocrOnly = isOcrOnlyMode();
    const workflow = ocrOnly ? WORKFLOW_OCR : developerConfig.workflow;
    const uploadState = getUploadState();
    const submitValues = currentWorkflowSubmitValues();
    const effectiveNeedsUpload = ocrOnly ? () => true : workflowNeedsUpload;
    const payload: WorkflowRunPayload = {
      workflow,
      source: buildSourcePayloadRequest({
        workflow,
        developerConfig,
        uploadId: uploadState.uploadId,
        workflowNeedsUpload: effectiveNeedsUpload,
      }),
      runtime: {
        job_id: "",
        timeout_seconds: developerConfig.timeoutSeconds,
      },
    };
    if (ocrOnly) {
      payload.ocr = buildOcrPayload(pageRanges, submitValues);
      return payload;
    }
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
    buildOcrJobConfig,
    buildTranslateJobConfig,
    collectRunPayload,
    currentRenderSourceJobId,
    currentWorkflow,
    currentBudgetState,
    developerConfigWithDefaults,
    isOcrOnly: isOcrOnlyMode,
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
