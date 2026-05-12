import { $ } from "../../dom.js";

export function setDeveloperDialogValues(config) {
  $("developer-workflow").value = config.workflow;
  $("developer-render-source-job-id").value = config.renderSourceJobId;
  $("developer-model").value = config.model;
  $("developer-base-url").value = config.baseUrl;
  $("developer-workers").value = `${config.workers}`;
  $("developer-batch-size").value = `${config.batchSize}`;
  $("developer-classify-batch-size").value = `${config.classifyBatchSize}`;
  $("developer-compile-workers").value = `${config.compileWorkers}`;
  $("developer-timeout-seconds").value = `${config.timeoutSeconds}`;
}

export function readDeveloperDialogValues(defaults) {
  return {
    workflow: $("developer-workflow")?.value,
    renderSourceJobId: $("developer-render-source-job-id")?.value?.trim() || "",
    model: $("developer-model")?.value?.trim() || defaults.model,
    baseUrl: $("developer-base-url")?.value?.trim() || defaults.baseUrl,
    workers: Number($("developer-workers")?.value || defaults.workers),
    batchSize: Number($("developer-batch-size")?.value || defaults.batchSize),
    classifyBatchSize: Number($("developer-classify-batch-size")?.value || defaults.classifyBatchSize),
    compileWorkers: Number($("developer-compile-workers")?.value || defaults.compileWorkers),
    timeoutSeconds: Number($("developer-timeout-seconds")?.value || defaults.timeoutSeconds),
  };
}

export function setDeveloperWorkflowFormState({ workflow, workflowRender, workflowTranslate } = {}) {
  const renderWrap = $("developer-render-source-wrap");
  const note = $("developer-workflow-note");
  renderWrap?.classList.toggle("hidden", workflow !== workflowRender);
  if (note) {
    note.textContent = workflow === workflowRender
      ? "render 会跳过 OCR 与翻译，直接复用已有任务产物重新渲染 PDF。"
      : workflow === workflowTranslate
        ? "translate 会执行 OCR 与翻译，但不会进入最终 PDF 渲染。"
        : "book 会完整执行 OCR、翻译与 PDF 渲染。";
  }
}

export function readDeveloperWorkflowValue() {
  return $("developer-workflow")?.value;
}

export function setSubmitControls({ disabled, label, actionVisible, pageRangeVisible }) {
  if ($("submit-btn")) {
    $("submit-btn").disabled = disabled;
    $("submit-btn").textContent = label;
  }
  $("upload-action-slot")?.classList.toggle("hidden", !actionVisible);
  $("page-range-btn")?.classList.toggle("hidden", !pageRangeVisible);
}

export function applyMockUploadView({ mockScenario, submitLabel, showPageRangeButton }) {
  const fileInput = $("file");
  const tile = fileInput?.closest(".upload-tile");
  const uploadGlyph = $("upload-glyph");
  const fileLabel = $("file-label");
  const uploadHelp = $("upload-help");
  const uploadMeta = document.querySelector(".upload-meta");
  const uploadStatus = $("upload-status");
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
    uploadHelp.textContent = `当前为 mock 模式：${mockScenario || "running"}。不会上传文件，也不会请求真实后端。`;
    uploadHelp.classList.remove("hidden");
  }
  if (uploadStatus) {
    uploadStatus.textContent = "Mock 模式已启用，可直接点击开始翻译。";
    uploadStatus.classList.remove("hidden");
  }
  setSubmitControls({
    disabled: false,
    label: submitLabel,
    actionVisible: true,
    pageRangeVisible: showPageRangeButton,
  });
}

export function applyWorkflowUploadView({
  needsUpload,
  uploadReady,
  defaultFileLabel,
  headline,
  renderSourceJobId,
}) {
  const fileInput = $("file");
  const tile = fileInput?.closest(".upload-tile");
  const uploadGlyph = $("upload-glyph");
  const fileLabel = $("file-label");
  const uploadHelp = $("upload-help");
  const uploadMeta = document.querySelector(".upload-meta");
  const uploadStatus = $("upload-status");
  if (fileInput) {
    fileInput.disabled = !needsUpload;
  }
  tile?.classList.toggle("is-locked", !needsUpload);
  uploadGlyph?.classList.toggle("hidden", !needsUpload);
  uploadMeta?.classList.toggle("hidden", !needsUpload);
  if (fileLabel && !uploadReady) {
    fileLabel.textContent = needsUpload ? defaultFileLabel : "复用已有任务产物";
    fileLabel.title = "";
    fileLabel.classList.remove("hidden");
  }
  if (uploadHelp) {
    uploadHelp.textContent = headline;
    uploadHelp.classList.remove("hidden");
  }
  if (!needsUpload && uploadStatus) {
    uploadStatus.textContent = renderSourceJobId
      ? `当前将复用任务: ${renderSourceJobId}`
      : "请先在开发者设置里填写 Render 源任务 ID。";
    uploadStatus.classList.remove("hidden");
  } else if (!uploadReady) {
    uploadStatus?.classList.add("hidden");
  }
}

export function closeDeveloperDialog() {
  $("developer-dialog")?.close();
}

export function readOcrProviderValue(defaultOcrProvider) {
  return $("ocr_provider")?.value || defaultOcrProvider;
}

export function readOcrTokenValue({ providerId, defaultPaddleToken, defaultMineruToken }) {
  return providerId === "paddle"
    ? ($("paddle_token")?.value || defaultPaddleToken)
    : ($("mineru_token")?.value || defaultMineruToken);
}

export function readModelApiKey(defaultModelApiKey) {
  return $("api_key")?.value || defaultModelApiKey;
}
