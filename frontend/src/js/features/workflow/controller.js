import { $ } from "../../dom.js";
import { DEFAULT_FILE_LABEL } from "../../constants.js";

export function mountWorkflowFeature({
  state,
  isMockMode,
  saveDeveloperStoredConfig,
  defaultModelName,
  defaultModelBaseUrl,
  defaultMineruToken,
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
    WORKFLOW_MINERU,
    WORKFLOW_TRANSLATE,
    WORKFLOW_RENDER,
  } = constants;

  let refreshSubmitControlsRef = null;
  let applyWorkflowModeRef = null;
  const hasAppliedPageRange = () => workflowNeedsUpload() && `${state.appliedPageRange || ""}`.trim().length > 0;

  function developerConfigWithDefaults() {
    const saved = state.developerConfig || {};
    return {
      workflow: normalizeWorkflow(saved.workflow),
      renderSourceJobId: `${saved.renderSourceJobId || ""}`.trim(),
      mathMode: normalizeMathMode(saved.mathMode),
      model: saved.model || defaultModelName(),
      baseUrl: saved.baseUrl || defaultModelBaseUrl(),
      workers: Number(saved.workers || DEFAULT_WORKERS),
      batchSize: Number(saved.batchSize || DEFAULT_BATCH_SIZE),
      classifyBatchSize: Number(saved.classifyBatchSize || DEFAULT_CLASSIFY_BATCH_SIZE),
      compileWorkers: Number(saved.compileWorkers || DEFAULT_COMPILE_WORKERS),
      timeoutSeconds: Number(saved.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS),
      translateTitles: saved.translateTitles !== false,
    };
  }

  function syncDeveloperDialogFromState() {
    const config = developerConfigWithDefaults();
    $("developer-workflow").value = config.workflow;
    $("developer-render-source-job-id").value = config.renderSourceJobId;
    $("developer-model").value = config.model;
    $("developer-base-url").value = config.baseUrl;
    $("developer-workers").value = `${config.workers}`;
    $("developer-batch-size").value = `${config.batchSize}`;
    $("developer-classify-batch-size").value = `${config.classifyBatchSize}`;
    $("developer-compile-workers").value = `${config.compileWorkers}`;
    $("developer-timeout-seconds").value = `${config.timeoutSeconds}`;
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
    return workflow === WORKFLOW_MINERU || workflow === WORKFLOW_RENDER;
  }

  function workflowSubmitLabel(workflow = currentWorkflow()) {
    switch (workflow) {
      case WORKFLOW_RENDER:
        return "开始渲染";
      case WORKFLOW_TRANSLATE:
        return "开始翻译";
      case WORKFLOW_MINERU:
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
    const workflow = normalizeWorkflow($("developer-workflow")?.value);
    const renderWrap = $("developer-render-source-wrap");
    const note = $("developer-workflow-note");
    renderWrap?.classList.toggle("hidden", workflow !== WORKFLOW_RENDER);
    if (note) {
      note.textContent = workflow === WORKFLOW_RENDER
        ? "render 会跳过 OCR 与翻译，直接复用已有任务产物重新渲染 PDF。"
        : workflow === WORKFLOW_TRANSLATE
          ? "translate 会执行 OCR 与翻译，但不会进入最终 PDF 渲染。"
          : "mineru 会完整执行 OCR、翻译与 PDF 渲染。";
    }
  }

  function refreshSubmitControls() {
    const workflow = currentWorkflow();
    const showPageRangeButton = workflowNeedsUpload(workflow) && !hasAppliedPageRange();
    if (isMockMode()) {
      $("submit-btn").disabled = false;
      $("submit-btn").textContent = workflowSubmitLabel(workflow);
      $("upload-action-slot")?.classList.remove("hidden");
      $("page-range-btn")?.classList.toggle("hidden", !showPageRangeButton);
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
    $("submit-btn").disabled = credentialsMissing || !canSubmit;
    $("submit-btn").textContent = workflowSubmitLabel(workflow);
    $("upload-action-slot")?.classList.toggle("hidden", credentialsMissing || (needsUpload ? !uploadReady : false));
    $("page-range-btn")?.classList.toggle("hidden", !showPageRangeButton);
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
    const fileInput = $("file");
    const tile = fileInput?.closest(".upload-tile");
    const uploadGlyph = $("upload-glyph");
    const fileLabel = $("file-label");
    const uploadHelp = $("upload-help");
    const uploadMeta = document.querySelector(".upload-meta");
    const uploadStatus = $("upload-status");
    const needsUpload = workflowNeedsUpload(workflow);
    if (isMockMode()) {
      if (fileInput) {
        fileInput.disabled = true;
      }
      tile?.classList.add("is-locked");
      uploadGlyph?.classList.add("hidden");
      uploadMeta?.classList.add("hidden");
      if (fileLabel) {
        fileLabel.textContent = "Mock 模式";
        fileLabel.title = "";
        fileLabel.classList.remove("hidden");
      }
      if (uploadHelp) {
        uploadHelp.textContent = `当前为 mock 模式：${new URLSearchParams(window.location.search).get("mock") || "running"}。不会上传文件，也不会请求真实后端。`;
        uploadHelp.classList.remove("hidden");
      }
      if (uploadStatus) {
        uploadStatus.textContent = "Mock 模式已启用，可直接点击开始翻译。";
        uploadStatus.classList.remove("hidden");
      }
      renderPageRangeSummary();
      refreshSubmitControls();
      updateCredentialGate();
      return;
    }
    if (fileInput) {
      fileInput.disabled = !needsUpload;
    }
    tile?.classList.toggle("is-locked", !needsUpload);
    uploadGlyph?.classList.toggle("hidden", !needsUpload);
    uploadMeta?.classList.toggle("hidden", !needsUpload);
    if (fileLabel && !state.uploadId) {
      fileLabel.textContent = needsUpload ? DEFAULT_FILE_LABEL : "复用已有任务产物";
      fileLabel.title = "";
      fileLabel.classList.remove("hidden");
    }
    if (uploadHelp) {
      uploadHelp.textContent = workflowHeadline(workflow);
      uploadHelp.classList.remove("hidden");
    }
    if (!needsUpload && uploadStatus) {
      const renderSourceJobId = currentRenderSourceJobId();
      uploadStatus.textContent = renderSourceJobId
        ? `当前将复用任务: ${renderSourceJobId}`
        : "请先在开发者设置里填写 Render 源任务 ID。";
      uploadStatus.classList.remove("hidden");
    } else if (!state.uploadId) {
      uploadStatus?.classList.add("hidden");
    }
    renderPageRangeSummary();
    refreshSubmitControls();
    updateCredentialGate();
  }

  function saveDeveloperDialog() {
    const currentConfig = developerConfigWithDefaults();
    state.developerConfig = {
      workflow: normalizeWorkflow($("developer-workflow")?.value),
      renderSourceJobId: $("developer-render-source-job-id")?.value?.trim() || "",
      mathMode: currentConfig.mathMode,
      model: $("developer-model")?.value?.trim() || defaultModelName(),
      baseUrl: $("developer-base-url")?.value?.trim() || defaultModelBaseUrl(),
      workers: Number($("developer-workers")?.value || DEFAULT_WORKERS),
      batchSize: Number($("developer-batch-size")?.value || DEFAULT_BATCH_SIZE),
      classifyBatchSize: Number($("developer-classify-batch-size")?.value || DEFAULT_CLASSIFY_BATCH_SIZE),
      compileWorkers: Number($("developer-compile-workers")?.value || DEFAULT_COMPILE_WORKERS),
      timeoutSeconds: Number($("developer-timeout-seconds")?.value || DEFAULT_TIMEOUT_SECONDS),
      translateTitles: currentConfig.translateTitles,
    };
    saveDeveloperStoredConfig(state.developerConfig);
    applyWorkflowMode();
    $("developer-dialog")?.close();
  }

  function resetDeveloperDialog() {
    state.developerConfig = {};
    saveDeveloperStoredConfig({});
    syncDeveloperDialogFromState();
    applyWorkflowMode();
  }

  function collectRunPayload() {
    const pageRanges = currentPageRanges();
    const developerConfig = developerConfigWithDefaults();
    const workflow = developerConfig.workflow;
    const payload = {
      workflow,
      source: workflowNeedsUpload(workflow)
        ? { upload_id: state.uploadId }
        : { artifact_job_id: developerConfig.renderSourceJobId },
      runtime: {
        timeout_seconds: developerConfig.timeoutSeconds,
      },
    };
    if (workflow === WORKFLOW_MINERU || workflow === WORKFLOW_TRANSLATE) {
      payload.ocr = {
        provider: "mineru",
        mineru_token: $("mineru_token").value || defaultMineruToken(),
        model_version: DEFAULT_MODEL_VERSION,
        language: DEFAULT_LANGUAGE,
        page_ranges: pageRanges,
      };
      payload.translation = {
        mode: DEFAULT_MODE,
        model: developerConfig.model,
        base_url: developerConfig.baseUrl,
        api_key: $("api_key").value || defaultModelApiKey(),
        workers: developerConfig.workers,
        batch_size: developerConfig.batchSize,
        classify_batch_size: developerConfig.classifyBatchSize,
        rule_profile_name: DEFAULT_RULE_PROFILE,
        custom_rules_text: "",
        skip_title_translation: !developerConfig.translateTitles,
      };
      if (developerConfig.mathMode === "direct_typst") {
        payload.translation.math_mode = "direct_typst";
      }
    }
    if (workflowUsesRenderStage(workflow)) {
      payload.render = {
        render_mode: DEFAULT_RENDER_MODE,
        compile_workers: developerConfig.compileWorkers,
      };
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
