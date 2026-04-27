import { $ } from "./dom.js";
import * as pdfjsLib from "../../node_modules/pdfjs-dist/build/pdf.mjs";
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
  submitJobRequest,
  submitJson,
  submitUploadRequest,
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
import { mountRecentJobsFeature } from "./features/recent-jobs/controller.js";
import { mountStatusDetailFeature } from "./features/status-detail/controller.js";
import { mountUploadFeature } from "./features/upload/controller.js";
import { mountWorkflowFeature } from "./features/workflow/controller.js";
import { state } from "./state.js";
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
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "../../node_modules/pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();
const PDFJS_CMAP_URL = new URL("../../node_modules/pdfjs-dist/cmaps/", import.meta.url).toString();
const PDFJS_STANDARD_FONT_DATA_URL = new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).toString();
let browserCredentialsFeature = null;
let developerFeature = null;
let artifactDownloadsFeature = null;
let appActionsFeature = null;
let appShellFeature = null;
let jobRuntimeFeature = null;
let readerDialogComponentPromise = null;
let readerDialogFeature = null;
let readerDialogFeaturePromise = null;
let statusDetailFeature = null;
let uploadFeature = null;
let workflowFeature = null;

function normalizeWorkflow(value) {
  const workflow = `${value || ""}`.trim();
  if (workflow === WORKFLOW_TRANSLATE || workflow === WORKFLOW_RENDER) {
    return workflow;
  }
  return WORKFLOW_BOOK;
}

function normalizeMathMode(value) {
  return `${value || ""}`.trim() === "placeholder" ? "placeholder" : "direct_typst";
}

function getRequestedReaderJobIdFromLocation() {
  const url = new URL(window.location.href);
  const view = `${url.searchParams.get("view") || ""}`.trim();
  const jobId = `${url.searchParams.get("job_id") || ""}`.trim();
  return view === "reader" && jobId ? jobId : "";
}

async function ensureReaderDialogFeature() {
  if (readerDialogFeature) {
    return readerDialogFeature;
  }
  if (!readerDialogFeaturePromise) {
    if (!readerDialogComponentPromise) {
      readerDialogComponentPromise = import("./components/dialogs/reader-dialog.js")
        .catch((error) => {
          readerDialogComponentPromise = null;
          throw error;
        });
    }
    readerDialogFeaturePromise = readerDialogComponentPromise
      .then(() => import("./features/reader-dialog/controller.js"))
      .then(({ mountReaderDialogFeature }) => {
        const feature = mountReaderDialogFeature({
          state,
          fetchProtected,
          setText,
        });
        feature.bindEvents();
        readerDialogFeature = feature;
        return feature;
      })
      .catch((error) => {
        readerDialogFeaturePromise = null;
        throw error;
      });
  }
  return readerDialogFeaturePromise;
}

function setText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value;
  }
  if (id === "error-box") {
    const inlineError = $("error-box-inline");
    if (inlineError) {
      const text = `${value ?? ""}`.trim();
      inlineError.textContent = value;
      inlineError.classList.toggle("hidden", !text || text === "-");
    }
  }
}

function collectUploadFormData(file) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

async function countPdfPages(file) {
  if (!file) {
    return 0;
  }
  const doc = await pdfjsLib.getDocument({
    data: await file.arrayBuffer(),
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
    disableFontFace: true,
    disableRange: true,
    disableStream: true,
  }).promise;
  try {
    return Number(doc?.numPages || 0);
  } finally {
    if (doc?.destroy) {
      await doc.destroy().catch(() => {});
    }
  }
}

async function handleFileSelected() {
  await uploadFeature?.handleFileSelected();
}

async function submitForm(event) {
  await appActionsFeature?.submitForm(event);
}

async function handleDesktopSetupSave() {
  await appActionsFeature?.handleDesktopSetupSave();
}

async function handleOpenOutputDir() {
  await appActionsFeature?.handleOpenOutputDir();
}

async function checkApiConnectivity() {
  await appActionsFeature?.checkApiConnectivity();
}

async function initializePage() {
  const persistedConfig = await loadPersistedConfig();
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
    constants: {
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
    },
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
  statusDetailFeature = mountStatusDetailFeature({
    state,
    apiPrefix: API_PREFIX,
    fetchTranslationDiagnostics,
    fetchTranslationItems,
    fetchTranslationItem,
    replayTranslationItem,
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
  developerFeature.bindEvents();
  artifactDownloadsFeature.bindEvents();
  statusDetailFeature.bindEvents();
  appShellFeature.bindChrome();
  $("file")?.addEventListener("change", handleFileSelected);
  $("ocr_provider")?.addEventListener("input", saveBrowserStoredConfig);
  $("mineru_token")?.addEventListener("input", saveBrowserStoredConfig);
  $("paddle_token")?.addEventListener("input", saveBrowserStoredConfig);
  $("api_key")?.addEventListener("input", saveBrowserStoredConfig);
  $("job-form")?.addEventListener("submit", submitForm);
  $("page-range-btn")?.addEventListener("click", () => uploadFeature?.openPageRangeDialog());
  $("page-range-summary")?.addEventListener("click", () => uploadFeature?.openPageRangeDialog());
  $("page-range-apply-btn")?.addEventListener("click", () => uploadFeature?.applyPageRanges());
  $("page-range-clear-btn")?.addEventListener("click", () => uploadFeature?.clearPageRanges());
  $("cancel-btn")?.addEventListener("click", () => jobRuntimeFeature?.cancelCurrentJob());
  $("stop-btn")?.addEventListener("click", () => jobRuntimeFeature?.stopPolling());
  $("reader-btn")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const currentTarget = event.currentTarget;
    const url = `${currentTarget?.dataset?.url || ""}`.trim();
    const disabled = currentTarget?.classList?.contains("disabled")
      || currentTarget?.getAttribute?.("aria-disabled") === "true";
    let jobId = "";
    if (url) {
      try {
        jobId = new URL(url, window.location.href).searchParams.get("job_id")?.trim() || "";
      } catch (_err) {
        jobId = "";
      }
    }
    if (!jobId) {
      jobId = `${state.currentJobId || ""}`.trim();
    }
    try {
      const feature = await ensureReaderDialogFeature();
      feature.open({
        url,
        jobId,
        disabled,
      });
    } catch (error) {
      setText("error-box", error.message || String(error));
    }
  });
  $("back-home-btn")?.addEventListener("click", () => jobRuntimeFeature?.returnToHome());
  $("desktop-setup-save-btn")?.addEventListener("click", handleDesktopSetupSave);
  $("open-output-btn")?.addEventListener("click", handleOpenOutputDir);
  appShellFeature.initializeIdleView();
  mountRecentJobsFeature({
    fetchJobList,
    apiPrefix: API_PREFIX,
    startPolling: (jobId) => jobRuntimeFeature?.startPolling(jobId),
  });

  const startupReaderJobId = getRequestedReaderJobIdFromLocation();
  if (startupReaderJobId) {
    jobRuntimeFeature?.startPolling(startupReaderJobId);
    window.setTimeout(async () => {
      try {
        const feature = await ensureReaderDialogFeature();
        feature.open({ jobId: startupReaderJobId });
      } catch (error) {
        setText("error-box", error.message || String(error));
      }
    }, 0);
  }
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
