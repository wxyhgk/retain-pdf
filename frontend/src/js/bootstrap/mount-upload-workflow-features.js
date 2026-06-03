import {
  apiBase,
  defaultMineruToken,
  defaultOcrProvider,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultModelName,
  isMockMode,
  savePersistedDeveloperStoredConfig,
} from "../config.js";
import {
  API_PREFIX,
  DEFAULT_FILE_LABEL,
  FRONT_MAX_BYTES,
  FRONT_MAX_PAGE_COUNT,
} from "../constants.js";
import { mountDeveloperFeature } from "../features/developer/controller.js";
import { mountUploadFeature } from "../features/upload/controller.js";
import { mountWorkflowFeature } from "../features/workflow/controller.js";
import {
  collectUploadFormData,
  countPdfPages,
  normalizeMathMode,
  normalizeWorkflow,
  setText,
} from "../main-helpers.js";
import { fetchGlossaries } from "../api/glossaries.js";
import { submitUploadRequest } from "../api/http.js";
import { state } from "../state.js";
import {
  clearFileInputValue,
  resetUploadProgress,
  resetUploadedFile,
  setUploadProgress,
} from "../ui.js";
import { WORKFLOW_RENDER, workflowConstants } from "./workflow-constants.js";

export function mountUploadWorkflowFeatures(features) {
  features.workflowFeature = mountWorkflowFeature({
    state,
    isMockMode,
    saveDeveloperStoredConfig: savePersistedDeveloperStoredConfig,
    defaultModelName,
    defaultModelBaseUrl,
    defaultMineruToken,
    defaultPaddleApiUrl,
    defaultPaddleToken,
    defaultOcrProvider,
    defaultModelApiKey,
    normalizeWorkflow,
    normalizeMathMode,
    constants: workflowConstants(),
    currentPageRanges: () => features.uploadFeature?.currentPageRanges() || "",
    renderPageRangeSummary: () => features.uploadFeature?.renderPageRangeSummary(),
    getBrowserCredentialsFeature: () => features.browserCredentialsFeature,
    fetchGlossaries,
    apiPrefix: API_PREFIX,
    setText,
  });
  features.workflowFeature?.bindLanguageEvents();
  features.developerFeature = mountDeveloperFeature({
    syncDeveloperDialogFromState: () => features.workflowFeature?.syncDeveloperDialogFromState(),
    updateDeveloperWorkflowFormState: () => features.workflowFeature?.updateDeveloperWorkflowFormState(),
    saveDeveloperDialog: () => features.workflowFeature?.saveDeveloperDialog(),
    resetDeveloperDialog: () => features.workflowFeature?.resetDeveloperDialog(),
  });
  features.uploadFeature = mountUploadFeature({
    state,
    apiBase,
    apiPrefix: API_PREFIX,
    frontMaxBytes: FRONT_MAX_BYTES,
    frontMaxPageCount: FRONT_MAX_PAGE_COUNT,
    countPdfPages,
    defaultFileLabel: DEFAULT_FILE_LABEL,
    collectUploadFormData,
    submitUploadRequest,
    resetUploadedFile,
    resetUploadProgress,
    setUploadProgress,
    clearFileInputValue,
    setText,
    applyWorkflowMode: () => features.workflowFeature?.applyWorkflowMode(),
    refreshSubmitControls: () => features.workflowFeature?.refreshSubmitControls(),
    refreshDeepSeekBalance: (options) => features.browserCredentialsFeature?.refreshDeepSeekBalance?.(options),
    workflowNeedsUpload: (workflow) => features.workflowFeature?.workflowNeedsUpload(workflow) ?? (workflow !== WORKFLOW_RENDER),
  });
}
