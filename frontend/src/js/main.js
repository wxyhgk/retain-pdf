import {
  apiBase,
  applyKeyInputs,
  defaultMineruToken,
  defaultOcrProvider,
  defaultPaddleToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultModelName,
  isMockMode,
  isDesktopMode,
  loadPersistedConfig,
  openDesktopOutputDirectory,
  saveBrowserStoredConfig,
  savePersistedDeveloperStoredConfig,
} from "./config.js";
import {
  API_PREFIX,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CLASSIFY_BATCH_SIZE,
  DEFAULT_COMPILE_WORKERS,
  DEFAULT_FILE_LABEL,
  DEFAULT_LANGUAGE,
  DEFAULT_MODE,
  DEFAULT_MODEL_VERSION,
  DEFAULT_RULE_PROFILE,
  DEFAULT_RENDER_MODE,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_WORKERS,
  FRONT_MAX_BYTES,
  FRONT_MAX_PAGE_COUNT,
} from "./constants.js";
import {
  bootstrapDesktop,
  openSetupDialog,
  saveDesktopConfig,
  setDesktopBusy,
} from "./desktop.js";
import {
  buildApiEndpoint,
  buildJobDetailEndpoint,
  fetchJobEvents,
  fetchJobArtifactsManifest,
  fetchJobList,
  fetchJobPayload,
  fetchProtected,
  fetchTranslationDiagnostics,
  fetchTranslationItem,
  fetchTranslationItems,
  replayTranslationItem,
  rerunJob,
  submitJobRequest,
  submitJson,
  submitUploadRequest,
  queryDeepSeekBalance,
  validateDeepSeekToken,
  validatePaddleToken,
  validateMineruToken,
} from "./network.js";
import { mountAppActionsFeature } from "./features/app-actions/controller.js";
import { mountAppShellFeature } from "./features/app-shell/controller.js";
import { mountArtifactDownloadsFeature } from "./features/artifact-downloads/controller.js";
import { mountBrowserCredentialsFeature } from "./features/credentials/browser.js";
import { mountDeveloperFeature } from "./features/developer/controller.js";
import { mountJobRuntimeFeature } from "./features/job-runtime/controller.js";
import { mountStatusDetailFeature } from "./features/status-detail/controller.js";
import { mountUploadFeature } from "./features/upload/controller.js";
import { mountWorkflowFeature } from "./features/workflow/controller.js";
import { bindMainEvents } from "./main-events.js";
import {
  bootstrapStartupRoute,
  initializeIdleAndRecentJobs,
} from "./main-startup.js";
import { state } from "./state.js";
import {
  collectUploadFormData,
  countPdfPages,
  normalizeMathMode,
  normalizeWorkflow,
  setText,
} from "./main-helpers.js";
import {
  clearFileInputValue,
  prepareFilePicker,
  renderJob,
  resetUploadProgress,
  resetUploadedFile,
  setLinearProgress,
  setWorkflowSections,
  setUploadProgress,
  updateActionButtons,
  updateJobWarning,
} from "./ui.js";

const WORKFLOW_BOOK = "book";
const WORKFLOW_TRANSLATE = "translate";
const WORKFLOW_RENDER = "render";
let browserCredentialsFeature = null;
let developerFeature = null;
let artifactDownloadsFeature = null;
let appActionsFeature = null;
let appShellFeature = null;
let jobRuntimeFeature = null;
let readerDialogFeature = null;
let statusDetailFeature = null;
let uploadFeature = null;
let workflowFeature = null;

function applyPersistedConfig(persistedConfig) {
  const browserStored = persistedConfig.browserConfig || {};
  state.developerConfig = persistedConfig.developerConfig || {};
  applyKeyInputs(
    {
      ocrProvider: browserStored.ocrProvider || defaultOcrProvider(),
      mineruToken: browserStored.mineruToken || defaultMineruToken(),
      paddleToken: browserStored.paddleToken || defaultPaddleToken(),
      modelApiKey: browserStored.modelApiKey || defaultModelApiKey(),
    },
  );
}

function workflowConstants() {
  return {
    DEFAULT_WORKERS,
    DEFAULT_BATCH_SIZE,
    DEFAULT_CLASSIFY_BATCH_SIZE,
    DEFAULT_COMPILE_WORKERS,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_MODEL_VERSION,
    DEFAULT_LANGUAGE,
    DEFAULT_MODE,
    DEFAULT_RULE_PROFILE,
    DEFAULT_RENDER_MODE,
    WORKFLOW_BOOK,
    WORKFLOW_TRANSLATE,
    WORKFLOW_RENDER,
  };
}

async function checkApiConnectivity() {
  await appActionsFeature?.checkApiConnectivity();
}

function mountCoreFeatures() {
  appShellFeature = mountAppShellFeature({
    isMockMode,
    prepareFilePicker,
    setText,
    setWorkflowSections,
    setLinearProgress,
    updateActionButtons,
    renderPageRangeSummary: () => uploadFeature?.renderPageRangeSummary(),
    resetUploadProgress,
    resetUploadedFile,
    applyWorkflowMode: () => workflowFeature?.applyWorkflowMode(),
    updateJobWarning,
    activateDetailTab: (name) => statusDetailFeature?.activateDetailTab(name),
  });
}

function mountUploadWorkflowFeatures() {
  workflowFeature = mountWorkflowFeature({
    state,
    isMockMode,
    saveDeveloperStoredConfig: savePersistedDeveloperStoredConfig,
    defaultModelName,
    defaultModelBaseUrl,
    defaultMineruToken,
    defaultPaddleToken,
    defaultOcrProvider,
    defaultModelApiKey,
    normalizeWorkflow,
    normalizeMathMode,
    constants: workflowConstants(),
    currentPageRanges: () => uploadFeature?.currentPageRanges() || "",
    renderPageRangeSummary: () => uploadFeature?.renderPageRangeSummary(),
    getBrowserCredentialsFeature: () => browserCredentialsFeature,
  });
  developerFeature = mountDeveloperFeature({
    syncDeveloperDialogFromState: () => workflowFeature?.syncDeveloperDialogFromState(),
    updateDeveloperWorkflowFormState: () => workflowFeature?.updateDeveloperWorkflowFormState(),
    saveDeveloperDialog: () => workflowFeature?.saveDeveloperDialog(),
    resetDeveloperDialog: () => workflowFeature?.resetDeveloperDialog(),
  });
  uploadFeature = mountUploadFeature({
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
    applyWorkflowMode: () => workflowFeature?.applyWorkflowMode(),
    refreshSubmitControls: () => workflowFeature?.refreshSubmitControls(),
    workflowNeedsUpload: (workflow) => workflowFeature?.workflowNeedsUpload(workflow) ?? (workflow !== WORKFLOW_RENDER),
  });
}

function mountCredentialAndActionFeatures() {
  browserCredentialsFeature = mountBrowserCredentialsFeature({
    state,
    applyKeyInputs,
    defaultMineruToken,
    defaultPaddleToken,
    defaultModelApiKey,
    defaultModelBaseUrl,
    getTaskOptions: () => workflowFeature?.developerConfigWithDefaults() || {},
    saveTaskOptions: ({ mathMode, translateTitles }) => {
      state.developerConfig = {
        ...(state.developerConfig || {}),
        mathMode: normalizeMathMode(mathMode),
        translateTitles: translateTitles !== false,
      };
      void savePersistedDeveloperStoredConfig(state.developerConfig);
    },
    saveBrowserStoredConfig,
    saveDesktopConfig,
    checkApiConnectivity: () => appActionsFeature?.checkApiConnectivity(),
    validateOcrToken: (apiPrefix, providerId, token) => {
      if (providerId === "paddle") {
        return validatePaddleToken(apiPrefix, {
          paddle_token: token,
          base_url: "https://paddleocr.aistudio-app.com",
        });
      }
      return validateMineruToken(apiPrefix, {
        mineru_token: token,
        base_url: "https://mineru.net",
        model_version: DEFAULT_MODEL_VERSION,
      });
    },
    validateDeepSeekToken,
    queryDeepSeekBalance,
    onCredentialStateChange: () => workflowFeature?.applyWorkflowMode(),
  });
  artifactDownloadsFeature = mountArtifactDownloadsFeature({
    state,
    fetchProtected,
    setText,
  });
  appActionsFeature = mountAppActionsFeature({
    state,
    apiBase,
    apiPrefix: API_PREFIX,
    buildApiEndpoint,
    isMockMode,
    openSetupDialog,
    renderJob,
    setText,
    submitJson,
    submitJobRequest,
    saveDesktopConfig,
    setDesktopBusy,
    openDesktopOutputDirectory,
    resetUploadedFile,
    currentWorkflow: () => workflowFeature?.currentWorkflow() || WORKFLOW_BOOK,
    workflowNeedsCredentials: (workflow) => workflowFeature?.workflowNeedsCredentials(workflow) ?? (workflow !== WORKFLOW_RENDER),
    workflowNeedsUpload: (workflow) => workflowFeature?.workflowNeedsUpload(workflow) ?? (workflow !== WORKFLOW_RENDER),
    currentRenderSourceJobId: () => workflowFeature?.currentRenderSourceJobId() || "",
    collectRunPayload: () => workflowFeature?.collectRunPayload() || {},
    getBrowserCredentialsFeature: () => browserCredentialsFeature,
    getJobRuntimeFeature: () => jobRuntimeFeature,
    onDesktopConfigSaved: () => workflowFeature?.applyWorkflowMode(),
  });
}

function mountJobFeatures() {
  statusDetailFeature = mountStatusDetailFeature({
    state,
    apiPrefix: API_PREFIX,
    fetchTranslationDiagnostics,
    fetchTranslationItems,
    fetchTranslationItem,
    replayTranslationItem,
    rerunJob,
    startPolling: (jobId) => jobRuntimeFeature?.startPolling(jobId),
    setText,
  });
  jobRuntimeFeature = mountJobRuntimeFeature({
    state,
    apiPrefix: API_PREFIX,
    buildJobDetailEndpoint,
    fetchJobPayload,
    fetchJobEvents,
    fetchJobArtifactsManifest,
    submitJson,
    renderJob,
    setText,
    setWorkflowSections,
    resetUploadProgress,
    resetUploadedFile,
    applyWorkflowMode: () => workflowFeature?.applyWorkflowMode(),
    clearPageRanges: () => uploadFeature?.clearPageRanges(),
    updateJobWarning,
    activateDetailTab: (name) => statusDetailFeature?.activateDetailTab(name),
    onReaderDialogSync: () => readerDialogFeature?.syncToolbarActions(),
    onReaderDialogClose: () => readerDialogFeature?.close(),
  });
}

function bindFeatureEvents() {
  bindMainEvents({
    developerFeature,
    artifactDownloadsFeature,
    statusDetailFeature,
    appShellFeature,
    uploadFeature,
    appActionsFeature,
    jobRuntimeFeature,
    state,
    fetchProtected,
    setText,
  });
}

async function initializePage() {
  const persistedConfig = await loadPersistedConfig();
  applyPersistedConfig(persistedConfig);
  mountCoreFeatures();
  mountUploadWorkflowFeatures();
  mountCredentialAndActionFeatures();
  mountJobFeatures();
  bindFeatureEvents();
  initializeIdleAndRecentJobs({
    appShellFeature,
    fetchJobList,
    jobRuntimeFeature,
  });
  bootstrapStartupRoute({
    state,
    fetchProtected,
    jobRuntimeFeature,
    setText,
  });
  return persistedConfig;
}

export function initializeApp() {
  initializePage()
    .then((persistedConfig) => {
      if (isDesktopMode()) {
        bootstrapDesktop(persistedConfig)
          .then(() => {
            workflowFeature?.applyWorkflowMode();
          })
          .catch((err) => {
            setText("error-box", err.message || String(err));
          });
        return;
      }
      checkApiConnectivity().catch(() => {});
      workflowFeature?.updateCredentialGate();
    })
    .catch((err) => {
      setText("error-box", err.message || String(err));
    });
}
