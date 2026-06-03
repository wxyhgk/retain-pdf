import { $ } from "../../dom.js";
import { DEFAULT_FILE_LABEL } from "../../constants.js";
import {
  applyMockUploadView,
  applyWorkflowUploadView,
  closeDeveloperDialog,
  closeLanguageDialog,
  openLanguageDialog,
  readDeveloperDialogValues,
  readDeveloperWorkflowValue,
  readLanguageDialogTargetLanguage,
  readModelApiKey,
  readOcrProviderValue,
  readOcrTokenValue,
  renderTranslationBudgetNote,
  setDeveloperDialogValues,
  setDeveloperGlossaryOptions,
  setDeveloperWorkflowFormState,
  setSubmitControls,
} from "./view.js";
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
} from "./payload.js";
import { createGlossaryOptionsLoader } from "./glossary-options.js";
import {
  buildDeveloperConfigFromDialog,
  defaultDeveloperDialogReadOptions,
} from "./developer-dialog.js";
import { resolveSubmitControlState } from "./submit-controls.js";
import { resolveTranslationBudgetState } from "./budget.js";

export function mountWorkflowFeature({
  state,
  isMockMode,
  saveDeveloperStoredConfig,
  defaultModelName,
  defaultModelBaseUrl,
  defaultMineruToken,
  defaultPaddleApiUrl,
  defaultPaddleToken,
  defaultOcrProvider,
  defaultModelApiKey,
  normalizeWorkflow,
  normalizeMathMode,
  constants,
  currentPageRanges,
  renderPageRangeSummary,
  getBrowserCredentialsFeature,
  fetchGlossaries,
  apiPrefix,
  setText,
}) {
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
    setDeveloperGlossaryOptions,
    setText,
    getDefaultSelectedId: () => developerConfigWithDefaults().glossaryId,
  });

  function developerConfigWithDefaults() {
    return buildDeveloperConfigWithDefaults({
      saved: state.developerConfig,
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
    setDeveloperDialogValues(config, constants.TARGET_LANGUAGE_OPTIONS);
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
    const workflow = normalizeWorkflow(readDeveloperWorkflowValue());
    setDeveloperWorkflowFormState({
      workflow,
      workflowRender: WORKFLOW_RENDER,
      workflowTranslate: WORKFLOW_TRANSLATE,
    });
  }

  function refreshSubmitControls() {
    const workflow = currentWorkflow();
    const submitState = resolveSubmitControlState({
      workflow,
      isMock: isMockMode(),
      desktopMode: state.desktopMode,
      uploadId: state.uploadId,
      renderSourceJobId: currentRenderSourceJobId(),
      hasBrowserCredentials: Boolean(getBrowserCredentialsFeature()?.hasBrowserCredentials()),
      workflowNeedsUpload,
      workflowNeedsCredentials,
      workflowSubmitLabel,
    });
    const budget = currentBudgetState(workflow);
    renderTranslationBudgetNote(budget);
    setSubmitControls({
      ...submitState,
      disabled: submitState.disabled || budget.blocking,
    });
  }

  function currentBudgetState(workflow = currentWorkflow()) {
    return resolveTranslationBudgetState({
      pageRanges: currentPageRanges(),
      uploadedPageCount: state.uploadedPageCount,
      balanceCny: state.deepseekBalanceCny,
      balanceChecked: state.deepseekBalanceChecked,
      needsTranslation: workflowNeedsUpload(workflow) && workflowUsesTranslation(workflow) && Boolean(state.uploadId),
    });
  }

  function updateCredentialGate() {
    if (isMockMode()) {
      return;
    }
    getBrowserCredentialsFeature()?.updateCredentialGate({
      workflowNeedsCredentials: () => workflowNeedsCredentials(currentWorkflow()),
      workflowNeedsUpload: () => workflowNeedsUpload(currentWorkflow()),
      refreshSubmitControls,
    });
  }

  function applyWorkflowMode() {
    const workflow = currentWorkflow();
    const needsUpload = workflowNeedsUpload(workflow);
    const showPageRangeButton = workflowNeedsUpload(workflow);
    if (isMockMode()) {
      applyMockUploadView({
        mockScenario: new URLSearchParams(window.location.search).get("mock") || "running",
        submitLabel: workflowSubmitLabel(workflow),
        showPageRangeButton,
      });
      renderPageRangeSummary();
      updateCredentialGate();
      return;
    }
    applyWorkflowUploadView({
      needsUpload,
      uploadReady: Boolean(state.uploadId),
      defaultFileLabel: DEFAULT_FILE_LABEL,
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
    const values = readDeveloperDialogValues(defaultDeveloperDialogReadOptions({
      defaultModelName,
      defaultModelBaseUrl,
      defaults: {
        targetLanguage: constants.DEFAULT_TARGET_LANGUAGE || "",
        workers: DEFAULT_WORKERS,
        batchSize: DEFAULT_BATCH_SIZE,
        classifyBatchSize: DEFAULT_CLASSIFY_BATCH_SIZE,
        compileWorkers: DEFAULT_COMPILE_WORKERS,
        timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      },
    }));
    state.developerConfig = buildDeveloperConfigFromDialog({
      currentConfig,
      values,
      normalizeWorkflow,
    });
    setDeveloperDialogValues(developerConfigWithDefaults(), constants.TARGET_LANGUAGE_OPTIONS);
    void saveDeveloperStoredConfig(state.developerConfig);
    applyWorkflowMode();
    closeDeveloperDialog();
  }

  function resetDeveloperDialog() {
    state.developerConfig = {};
    void saveDeveloperStoredConfig({});
    syncDeveloperDialogFromState();
    applyWorkflowMode();
  }

  function buildOcrPayload(pageRanges) {
    return buildOcrPayloadRequest({
      pageRanges,
      readOcrProviderValue,
      readOcrTokenValue,
      defaultOcrProvider,
      defaultPaddleToken,
      defaultMineruToken,
      defaultPaddleApiUrl,
      constants,
    });
  }

  function buildTranslationPayload(developerConfig) {
    return buildTranslationPayloadRequest({
      developerConfig,
      readModelApiKey,
      defaultModelApiKey,
      constants,
    });
  }

  async function loadGlossaryOptions({ force = false, selectedId = "" } = {}) {
    return glossaryOptionsLoader.loadGlossaryOptions({ force, selectedId });
  }

  function buildRenderPayload(developerConfig) {
    return buildRenderPayloadRequest({
      developerConfig,
      constants,
    });
  }

  function collectRunPayload() {
    const pageRanges = currentPageRanges();
    const developerConfig = developerConfigWithDefaults();
    const workflow = developerConfig.workflow;
    const payload = {
      workflow,
      source: buildSourcePayloadRequest({
        workflow,
        developerConfig,
        uploadId: state.uploadId,
        workflowNeedsUpload,
      }),
      runtime: {
        job_id: "",
        timeout_seconds: developerConfig.timeoutSeconds,
      },
    };
    if (workflow === WORKFLOW_BOOK || workflow === WORKFLOW_TRANSLATE) {
      payload.ocr = buildOcrPayload(pageRanges);
      payload.translation = buildTranslationPayload(developerConfig);
    }
    if (workflowUsesRenderStage(workflow)) {
      payload.render = buildRenderPayload(developerConfig);
    }
    return payload;
  }

  function openLanguageSettings() {
    openLanguageDialog(
      developerConfigWithDefaults().targetLanguage,
      constants.TARGET_LANGUAGE_OPTIONS,
    );
  }

  function saveLanguageSettings() {
    const targetLanguage = readLanguageDialogTargetLanguage();
    state.developerConfig = {
      ...state.developerConfig,
      targetLanguage,
    };
    void saveDeveloperStoredConfig(state.developerConfig);
    closeLanguageDialog();
  }

  function bindLanguageEvents() {
    $("language-btn")?.addEventListener("click", openLanguageSettings);
    $("language-save-btn")?.addEventListener("click", saveLanguageSettings);
    $("language-cancel-btn")?.addEventListener("click", closeLanguageDialog);
  }

  return {
    applyWorkflowMode,
    bindLanguageEvents,
    applyWorkflowMode,
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
