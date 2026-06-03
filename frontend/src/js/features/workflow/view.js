import { $ } from "../../dom.js";

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

export function populateTargetLanguageOptions(languageOptions = [], selectId = "developer-target-language") {
  const select = $(selectId);
  if (!select) {
    return;
  }
  select.replaceChildren();
  for (const option of languageOptions) {
    select.append(new Option(option.label, option.value));
  }
}

export function setDeveloperDialogValues(config, languageOptions = []) {
  $("developer-workflow").value = config.workflow;
  $("developer-render-source-job-id").value = config.renderSourceJobId;
  $("developer-model").value = config.model;
  $("developer-base-url").value = config.baseUrl;
  if ($("developer-target-language")) {
    populateTargetLanguageOptions(languageOptions);
    $("developer-target-language").value = config.targetLanguage || "";
  }
  if ($("developer-glossary-id")) {
    $("developer-glossary-id").value = config.glossaryId || "";
  }
  if ($("job-glossary-id")) {
    $("job-glossary-id").value = config.glossaryId || "";
  }
  $("developer-workers").value = `${config.workers}`;
  $("developer-batch-size").value = `${config.batchSize}`;
  $("developer-classify-batch-size").value = `${config.classifyBatchSize}`;
  $("developer-compile-workers").value = `${config.compileWorkers}`;
  $("developer-timeout-seconds").value = `${config.timeoutSeconds}`;
}

export function setDeveloperGlossaryOptions(glossaries = [], selectedId = "") {
  const selects = [$("developer-glossary-id"), $("job-glossary-id")].filter(Boolean);
  const normalizedSelectedId = `${selectedId || ""}`.trim();
  for (const select of selects) {
    select.replaceChildren(new Option("不使用术语表", ""));
    for (const glossary of Array.isArray(glossaries) ? glossaries : []) {
      const glossaryId = `${glossary?.glossary_id || ""}`.trim();
      if (!glossaryId) {
        continue;
      }
      const name = `${glossary?.name || glossaryId}`.trim();
      const count = Number(glossary?.entry_count);
      const suffix = Number.isFinite(count) ? ` (${count})` : "";
      select.append(new Option(`${name}${suffix}`, glossaryId));
    }
    select.value = normalizedSelectedId;
    if (select.value !== normalizedSelectedId && normalizedSelectedId) {
      select.append(new Option(`已删除或不可用: ${normalizedSelectedId}`, normalizedSelectedId));
      select.value = normalizedSelectedId;
    }
  }
}

export function readDeveloperDialogValues(defaults) {
  return {
    workflow: $("developer-workflow")?.value,
    renderSourceJobId: $("developer-render-source-job-id")?.value?.trim() || "",
    model: $("developer-model")?.value?.trim() || defaults.model,
    baseUrl: $("developer-base-url")?.value?.trim() || defaults.baseUrl,
    targetLanguage: $("developer-target-language")?.value || defaults.targetLanguage || "",
    glossaryId: $("job-glossary-id")?.value?.trim() || $("developer-glossary-id")?.value?.trim() || "",
    workers: positiveInteger($("developer-workers")?.value, defaults.workers),
    batchSize: positiveInteger($("developer-batch-size")?.value, defaults.batchSize),
    classifyBatchSize: positiveInteger($("developer-classify-batch-size")?.value, defaults.classifyBatchSize),
    compileWorkers: positiveInteger($("developer-compile-workers")?.value, defaults.compileWorkers),
    timeoutSeconds: positiveInteger($("developer-timeout-seconds")?.value, defaults.timeoutSeconds),
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
    const busy = $("submit-btn").dataset.busy === "1";
    $("submit-btn").disabled = disabled || busy;
    $("submit-btn").textContent = label;
  }
  $("upload-action-slot")?.classList.toggle("hidden", !actionVisible);
  $("page-range-btn")?.classList.toggle("hidden", !pageRangeVisible);
}

export function renderTranslationBudgetNote(budget) {
  const note = $("translation-budget-note");
  if (!note) {
    return;
  }
  note.replaceChildren();
  note.classList.toggle("hidden", !budget?.visible);
  note.classList.toggle("is-error", budget?.tone === "error");
  note.classList.toggle("is-valid", budget?.tone === "valid");
  if (!budget?.visible) {
    return;
  }
  note.append(document.createTextNode(budget.message || ""));
  if (budget.blocking) {
    note.append(document.createTextNode(" · "));
    const link = document.createElement("a");
    link.href = budget.topUpUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "去充值";
    note.append(link);
  }
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

export function openLanguageDialog(targetLanguage = "", languageOptions = []) {
  const dialog = $("language-dialog");
  if (!dialog) {
    return;
  }
  populateTargetLanguageOptions(languageOptions, "target-language-select");
  if ($("target-language-select")) {
    $("target-language-select").value = targetLanguage || "";
  }
  dialog.showModal();
}

export function closeLanguageDialog() {
  $("language-dialog")?.close();
}

export function readLanguageDialogTargetLanguage() {
  return $("target-language-select")?.value || "";
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
    : ($("paddle_token")?.value || defaultPaddleToken || defaultMineruToken);
}

export function readModelApiKey(defaultModelApiKey) {
  return $("api_key")?.value || defaultModelApiKey;
}
