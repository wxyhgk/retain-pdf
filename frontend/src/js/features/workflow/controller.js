import { $ } from "../../dom.js";
import { DEFAULT_FILE_LABEL } from "../../constants.js";
import { getOcrProviderDefinition, normalizeOcrProvider } from "../../provider-config.js";
import {
  applyMockUploadView,
  applyWorkflowUploadView,
  closeDeveloperDialog,
  readDeveloperDialogValues,
  readDeveloperWorkflowValue,
  readModelApiKey,
  readOcrProviderValue,
  readOcrTokenValue,
  setDeveloperDialogValues,
  setDeveloperWorkflowFormState,
  setSubmitControls,
} from "./view.js";

export function mountWorkflowFeature({
  state,
  isMockMode,
  saveDeveloperStoredConfig,
  defaultModelName,
  defaultModelBaseUrl,
  defaultMineruToken,
  defaultPaddleToken,
  defaultOcrProvider,
  defaultModelApiKey,
  normalizeWorkflow,
  normalizeMathMode,
  constants,
  currentPageRanges,
  renderPageRangeSummary,
  getBrowserCredentialsFeature,
}) {
  const {
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
    DEFAULT_TYPST_FONT_FAMILY,
    DEFAULT_PDF_COMPRESS_DPI,
    DEFAULT_TRANSLATED_PDF_NAME,
    DEFAULT_BODY_FONT_SIZE_FACTOR,
    DEFAULT_BODY_LEADING_FACTOR,
    DEFAULT_INNER_BBOX_SHRINK_X,
    DEFAULT_INNER_BBOX_SHRINK_Y,
    DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
    DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
    DEFAULT_FONT_UNIFY_MODE,
    WORKFLOW_BOOK,
    WORKFLOW_TRANSLATE,
    WORKFLOW_RENDER,
  } = constants;

  let refreshSubmitControlsRef = null;
  let applyWorkflowModeRef = null;
  const hasAppliedPageRange = () => workflowNeedsUpload() && `${state.appliedPageRange || ""}`.trim().length > 0;

  function positiveInteger(value, fallback) {
    const fallbackNumber = Number(fallback);
    const normalizedFallback = Number.isFinite(fallbackNumber) && fallbackNumber > 0
      ? Math.floor(fallbackNumber)
      : 1;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return normalizedFallback;
    }
    return Math.floor(number);
  }

  function developerConfigWithDefaults() {
    const saved = state.developerConfig || {};
    return {
      workflow: normalizeWorkflow(saved.workflow),
      renderSourceJobId: `${saved.renderSourceJobId || ""}`.trim(),
      mathMode: normalizeMathMode(saved.mathMode),
      model: saved.model || defaultModelName(),
      baseUrl: saved.baseUrl || defaultModelBaseUrl(),
      workers: positiveInteger(saved.workers, DEFAULT_WORKERS),
      batchSize: positiveInteger(saved.batchSize, DEFAULT_BATCH_SIZE),
      classifyBatchSize: positiveInteger(saved.classifyBatchSize, DEFAULT_CLASSIFY_BATCH_SIZE),
      compileWorkers: positiveInteger(saved.compileWorkers, DEFAULT_COMPILE_WORKERS),
      timeoutSeconds: positiveInteger(saved.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS),
      translateTitles: saved.translateTitles !== false,
    };
  }

  function syncDeveloperDialogFromState() {
    const config = developerConfigWithDefaults();
    setDeveloperDialogValues(config);
    updateDeveloperWorkflowFormState();
  }

  function currentWorkflow() {
    return developerConfigWithDefaults().workflow;
  }

  function currentRenderSourceJobId() {
    return developerConfigWithDefaults().renderSourceJobId;
  }

  function workflowNeedsUpload(workflow = currentWorkflow()) {
    return workflow !== WORKFLOW_RENDER;
  }

  function workflowNeedsCredentials(workflow = currentWorkflow()) {
    return workflow !== WORKFLOW_RENDER;
  }

  function workflowUsesRenderStage(workflow = currentWorkflow()) {
    return workflow === WORKFLOW_BOOK || workflow === WORKFLOW_RENDER;
  }

  function workflowSubmitLabel(workflow = currentWorkflow()) {
    switch (workflow) {
      case WORKFLOW_RENDER:
        return "开始渲染";
      case WORKFLOW_TRANSLATE:
        return "开始翻译";
      case WORKFLOW_BOOK:
        return hasAppliedPageRange() ? "开始翻译" : "全书翻译";
      default:
        return hasAppliedPageRange() ? "开始翻译" : "全书翻译";
    }
  }

  function workflowHeadline(workflow = currentWorkflow()) {
    switch (workflow) {
      case WORKFLOW_RENDER:
        return "当前工作流会复用已有任务产物重新生成 PDF。";
      case WORKFLOW_TRANSLATE:
        return "上传后会执行 OCR 与正文翻译，不进入 PDF 渲染。";
      default:
        return "上传后会执行 OCR、翻译与 PDF 渲染。";
    }
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
    const showPageRangeButton = workflowNeedsUpload(workflow) && !hasAppliedPageRange();
    if (isMockMode()) {
      setSubmitControls({
        disabled: false,
        label: workflowSubmitLabel(workflow),
        actionVisible: true,
        pageRangeVisible: showPageRangeButton,
      });
      return;
    }
    const needsUpload = workflowNeedsUpload(workflow);
    const needsCredentials = workflowNeedsCredentials(workflow);
    const credentialsMissing = !state.desktopMode
      && needsCredentials
      && !getBrowserCredentialsFeature()?.hasBrowserCredentials();
    const renderReady = Boolean(currentRenderSourceJobId());
    const uploadReady = Boolean(state.uploadId);
    const canSubmit = needsUpload ? uploadReady : renderReady;
    setSubmitControls({
      disabled: credentialsMissing || !canSubmit,
      label: workflowSubmitLabel(workflow),
      actionVisible: !(credentialsMissing || (needsUpload ? !uploadReady : false)),
      pageRangeVisible: showPageRangeButton,
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
    const showPageRangeButton = workflowNeedsUpload(workflow) && !hasAppliedPageRange();
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
  }

  function saveDeveloperDialog() {
    const currentConfig = developerConfigWithDefaults();
    const values = readDeveloperDialogValues({
      model: defaultModelName(),
      baseUrl: defaultModelBaseUrl(),
      workers: DEFAULT_WORKERS,
      batchSize: DEFAULT_BATCH_SIZE,
      classifyBatchSize: DEFAULT_CLASSIFY_BATCH_SIZE,
      compileWorkers: DEFAULT_COMPILE_WORKERS,
      timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    });
    state.developerConfig = {
      workflow: normalizeWorkflow(values.workflow),
      renderSourceJobId: values.renderSourceJobId,
      mathMode: currentConfig.mathMode,
      model: values.model,
      baseUrl: values.baseUrl,
      workers: values.workers,
      batchSize: values.batchSize,
      classifyBatchSize: values.classifyBatchSize,
      compileWorkers: values.compileWorkers,
      timeoutSeconds: values.timeoutSeconds,
      translateTitles: currentConfig.translateTitles,
    };
    setDeveloperDialogValues(developerConfigWithDefaults());
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

  function buildSourcePayload(workflow, developerConfig) {
    return workflowNeedsUpload(workflow)
      ? { upload_id: state.uploadId }
      : { artifact_job_id: developerConfig.renderSourceJobId };
  }

  function buildOcrPayload(pageRanges) {
    const provider = normalizeOcrProvider(readOcrProviderValue(defaultOcrProvider()));
    const definition = getOcrProviderDefinition(provider);
    const token = readOcrTokenValue({
      providerId: definition.id,
      defaultPaddleToken: defaultPaddleToken(),
      defaultMineruToken: defaultMineruToken(),
    });
    return {
      provider,
      [definition.tokenField]: token,
      model_version: DEFAULT_MODEL_VERSION,
      language: DEFAULT_LANGUAGE,
      page_ranges: pageRanges,
    };
  }

  function buildTranslationPayload(developerConfig) {
    return {
      mode: DEFAULT_MODE,
      math_mode: developerConfig.mathMode,
      model: developerConfig.model,
      base_url: developerConfig.baseUrl,
      api_key: readModelApiKey(defaultModelApiKey()),
      workers: developerConfig.workers,
      batch_size: developerConfig.batchSize,
      classify_batch_size: developerConfig.classifyBatchSize,
      rule_profile_name: DEFAULT_RULE_PROFILE,
      custom_rules_text: "",
      glossary_id: "",
      glossary_entries: [],
      skip_title_translation: !developerConfig.translateTitles,
    };
  }

  function buildRenderPayload(developerConfig) {
    return {
      render_mode: DEFAULT_RENDER_MODE,
      compile_workers: developerConfig.compileWorkers,
      typst_font_family: DEFAULT_TYPST_FONT_FAMILY,
      pdf_compress_dpi: DEFAULT_PDF_COMPRESS_DPI,
      translated_pdf_name: DEFAULT_TRANSLATED_PDF_NAME,
      body_font_size_factor: DEFAULT_BODY_FONT_SIZE_FACTOR,
      body_leading_factor: DEFAULT_BODY_LEADING_FACTOR,
      inner_bbox_shrink_x: DEFAULT_INNER_BBOX_SHRINK_X,
      inner_bbox_shrink_y: DEFAULT_INNER_BBOX_SHRINK_Y,
      inner_bbox_dense_shrink_x: DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
      inner_bbox_dense_shrink_y: DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
      font_unify_mode: DEFAULT_FONT_UNIFY_MODE,
    };
  }

  function collectRunPayload() {
    const pageRanges = currentPageRanges();
    const developerConfig = developerConfigWithDefaults();
    const workflow = developerConfig.workflow;
    const payload = {
      workflow,
      source: buildSourcePayload(workflow, developerConfig),
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

  return {
    applyWorkflowMode,
    collectRunPayload,
    currentRenderSourceJobId,
    currentWorkflow,
    developerConfigWithDefaults,
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
