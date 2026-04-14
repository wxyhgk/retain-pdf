import { $ } from "./dom.js";
import {
  apiBase,
  applyKeyInputs,
  defaultMineruToken,
  defaultModelApiKey,
  defaultModelBaseUrl,
  defaultModelName,
  desktopInvoke,
  isDesktopMode,
  loadBrowserStoredConfig,
  loadDeveloperStoredConfig,
  saveDeveloperStoredConfig,
  saveBrowserStoredConfig,
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
} from "./constants.js";
import {
  bootstrapDesktop,
  openSettingsDialog,
  openSetupDialog,
  saveDesktopConfig,
  setDesktopBusy,
} from "./desktop.js";
import {
  isTerminalStatus,
  normalizeJobPayload,
  summarizeStatus,
} from "./job.js";
import {
  fetchJobEvents,
  fetchJobArtifactsManifest,
  fetchJobList,
  fetchJobPayload,
  fetchProtected,
  submitJson,
  submitUploadRequest,
  validateMineruToken,
} from "./network.js";
import { mountBrowserCredentialsFeature } from "./features/credentials/browser.js";
import { mountRecentJobsFeature } from "./features/recent-jobs/controller.js";
import { state } from "./state.js";
import {
  clearFileInputValue,
  prepareFilePicker,
  renderJob,
  resetUploadProgress,
  resetUploadedFile,
  setLinearProgress,
  setStatus,
  setWorkflowSections,
  setUploadProgress,
  updateActionButtons,
  updateJobWarning,
} from "./ui.js";

const DEVELOPER_PASSWORD = "Gk265157!";
const DEVELOPER_AUTH_SESSION_KEY = "retainpdf.developer.auth.v1";
const WORKFLOW_MINERU = "mineru";
const WORKFLOW_TRANSLATE = "translate";
const WORKFLOW_RENDER = "render";
let browserCredentialsFeature = null;

function normalizeWorkflow(value) {
  const workflow = `${value || ""}`.trim();
  if (workflow === WORKFLOW_TRANSLATE || workflow === WORKFLOW_RENDER) {
    return workflow;
  }
  return WORKFLOW_MINERU;
}

function normalizeMathMode(value) {
  return `${value || ""}`.trim() === "direct_typst" ? "direct_typst" : "placeholder";
}

function summarizeConfiguredMathMode(value) {
  const mathMode = normalizeMathMode(value);
  return mathMode === "direct_typst"
    ? "当前公式模式：direct_typst（模型直出公式）"
    : "当前公式模式：placeholder（公式占位保护）";
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

function bindDialogBackdropClose(id) {
  const dialog = $(id);
  if (!dialog) {
    return;
  }
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}

function closeInfoBubbles(except = null) {
  document.querySelectorAll(".developer-hint.is-open").forEach((node) => {
    if (node !== except) {
      node.classList.remove("is-open");
    }
  });
}

function bindInfoBubbles() {
  document.querySelectorAll(".developer-hint").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !trigger.classList.contains("is-open");
      closeInfoBubbles(trigger);
      trigger.classList.toggle("is-open", willOpen);
    });
  });

  document.addEventListener("click", () => {
    closeInfoBubbles();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeInfoBubbles();
    }
  });
}

function stopPolling() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

async function fetchJob(jobId) {
  const payload = await fetchJobPayload(jobId, API_PREFIX);
  let eventsPayload = { items: [], limit: 50, offset: 0 };
  let manifestPayload = { items: [] };
  try {
    eventsPayload = await fetchJobEvents(jobId, API_PREFIX, 50, 0);
  } catch (_err) {
    // Event stream is secondary; keep main status usable even if events fail.
  }
  try {
    manifestPayload = await fetchJobArtifactsManifest(jobId, API_PREFIX);
  } catch (_err) {
    // Artifacts manifest is secondary; keep main status usable even if manifest fails.
  }
  renderJob(payload, eventsPayload, manifestPayload);
  const job = normalizeJobPayload(payload);
  if (isTerminalStatus(job.status)) {
    stopPolling();
  }
}

function startPolling(jobId) {
  stopPolling();
  state.currentJobId = jobId;
  if (!state.currentJobStartedAt) {
    state.currentJobStartedAt = new Date().toISOString();
  }
  setWorkflowSections({ job_id: jobId, status: "queued" });
  fetchJob(jobId).catch((err) => {
    setText("error-box", err.message);
  });
  state.timer = setInterval(() => {
    fetchJob(jobId).catch((err) => {
      setText("error-box", err.message);
    });
  }, 3000);
}

function collectUploadFormData(file) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

function normalizePageRangeValue(startValue = "", endValue = "") {
  const start = startValue.trim();
  const end = endValue.trim();
  if (!start && !end) {
    return "";
  }
  if (start && end) {
    return start === end ? start : `${start}-${end}`;
  }
  return start || end;
}

function currentPageRanges() {
  const applied = state.appliedPageRange || "";
  if (applied) {
    return applied;
  }
  const start = $("page-range-start")?.value || "";
  const end = $("page-range-end")?.value || "";
  return normalizePageRangeValue(start, end);
}

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
  $("developer-math-mode").value = config.mathMode;
  $("developer-base-url").value = config.baseUrl;
  $("developer-workers").value = `${config.workers}`;
  $("developer-batch-size").value = `${config.batchSize}`;
  $("developer-classify-batch-size").value = `${config.classifyBatchSize}`;
  $("developer-compile-workers").value = `${config.compileWorkers}`;
  $("developer-timeout-seconds").value = `${config.timeoutSeconds}`;
  $("developer-translate-titles").checked = !!config.translateTitles;
  updateDeveloperWorkflowFormState();
}

function isDeveloperAuthorized() {
  try {
    return window.sessionStorage?.getItem(DEVELOPER_AUTH_SESSION_KEY) === "1";
  } catch (_err) {
    return false;
  }
}

function markDeveloperAuthorized() {
  try {
    window.sessionStorage?.setItem(DEVELOPER_AUTH_SESSION_KEY, "1");
  } catch (_err) {
    // Ignore private mode/storage failures.
  }
}

function showDeveloperSettingsDialog() {
  syncDeveloperDialogFromState();
  activateDeveloperTab("model");
  $("developer-dialog")?.showModal();
}

function openDeveloperDialog() {
  if (isDeveloperAuthorized()) {
    showDeveloperSettingsDialog();
    return;
  }
  const passwordInput = $("developer-auth-password");
  const errorBox = $("developer-auth-error");
  if (passwordInput) {
    passwordInput.value = "";
  }
  if (errorBox) {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }
  $("developer-auth-dialog")?.showModal();
  passwordInput?.focus();
}

function submitDeveloperAuth() {
  const passwordInput = $("developer-auth-password");
  const errorBox = $("developer-auth-error");
  const password = passwordInput?.value || "";
  if (password !== DEVELOPER_PASSWORD) {
    if (errorBox) {
      errorBox.textContent = "开发者密码错误。";
      errorBox.classList.remove("hidden");
    }
    passwordInput?.focus();
    passwordInput?.select();
    return;
  }
  markDeveloperAuthorized();
  $("developer-auth-dialog")?.close();
  showDeveloperSettingsDialog();
}

function saveDeveloperDialog() {
  state.developerConfig = {
    workflow: normalizeWorkflow($("developer-workflow")?.value),
    renderSourceJobId: $("developer-render-source-job-id")?.value?.trim() || "",
    mathMode: normalizeMathMode($("developer-math-mode")?.value),
    model: $("developer-model")?.value?.trim() || defaultModelName(),
    baseUrl: $("developer-base-url")?.value?.trim() || defaultModelBaseUrl(),
    workers: Number($("developer-workers")?.value || DEFAULT_WORKERS),
    batchSize: Number($("developer-batch-size")?.value || DEFAULT_BATCH_SIZE),
    classifyBatchSize: Number($("developer-classify-batch-size")?.value || DEFAULT_CLASSIFY_BATCH_SIZE),
    compileWorkers: Number($("developer-compile-workers")?.value || DEFAULT_COMPILE_WORKERS),
    timeoutSeconds: Number($("developer-timeout-seconds")?.value || DEFAULT_TIMEOUT_SECONDS),
    translateTitles: $("developer-translate-titles")?.checked !== false,
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

function activateDeveloperTab(tabName = "model") {
  document.querySelectorAll("[data-developer-tab]").forEach((tab) => {
    const active = tab.dataset.developerTab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-developer-panel]").forEach((panel) => {
    const active = panel.dataset.developerPanel === tabName;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
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
    default:
      return "开始处理";
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
  const needsUpload = workflowNeedsUpload(workflow);
  const needsCredentials = workflowNeedsCredentials(workflow);
  const credentialsMissing = !state.desktopMode && needsCredentials && !browserCredentialsFeature?.hasBrowserCredentials();
  const renderReady = Boolean(currentRenderSourceJobId());
  const uploadReady = Boolean(state.uploadId);
  const canSubmit = needsUpload ? uploadReady : renderReady;
  $("submit-btn").disabled = credentialsMissing || !canSubmit;
  $("submit-btn").textContent = workflowSubmitLabel(workflow);
  $("upload-action-slot")?.classList.toggle("hidden", credentialsMissing || (needsUpload ? !uploadReady : false));
  $("page-range-btn")?.classList.toggle("hidden", !needsUpload);
}

function applyWorkflowMode() {
  const workflow = currentWorkflow();
  const developerConfig = developerConfigWithDefaults();
  const fileInput = $("file");
  const tile = fileInput?.closest(".upload-tile");
  const uploadGlyph = $("upload-glyph");
  const fileLabel = $("file-label");
  const uploadHelp = $("upload-help");
  const uploadMeta = document.querySelector(".upload-meta");
  const uploadStatus = $("upload-status");
  const mathModeSummary = $("math-mode-summary");
  const needsUpload = workflowNeedsUpload(workflow);
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
  if (mathModeSummary) {
    const showMathMode = workflow === WORKFLOW_MINERU || workflow === WORKFLOW_TRANSLATE;
    mathModeSummary.textContent = summarizeConfiguredMathMode(developerConfig.mathMode);
    mathModeSummary.classList.toggle("hidden", !showMathMode);
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

function updateCredentialGate() {
  browserCredentialsFeature?.updateCredentialGate({
    workflowNeedsCredentials: () => workflowNeedsCredentials(currentWorkflow()),
    workflowNeedsUpload: () => workflowNeedsUpload(currentWorkflow()),
    refreshSubmitControls,
  });
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

function fileNameFromDisposition(disposition, fallback) {
  if (!disposition || typeof disposition !== "string") {
    return fallback;
  }
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (_err) {
      return utf8Match[1];
    }
  }
  const plainMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  return plainMatch && plainMatch[1] ? plainMatch[1] : fallback;
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

async function handleProtectedArtifactClick(event) {
  const link = event.currentTarget;
  const disabled = link.classList.contains("disabled") || link.getAttribute("aria-disabled") === "true";
  const url = link.dataset.url || "";
  if (disabled || !url) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  setText("error-box", "-");

  try {
    const resp = await fetchProtected(url);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
    }

    const blob = await resp.blob();
    const disposition = resp.headers.get("content-disposition") || "";
    const jobId = state.currentJobId || "result";
    const fallbackName = link.id === "download-btn"
      ? `${jobId}.zip`
      : link.id === "markdown-bundle-btn"
        ? `${jobId}-markdown.zip`
      : link.id === "pdf-btn"
        ? `${jobId}.pdf`
        : link.id === "markdown-raw-btn"
          ? `${jobId}.md`
          : `${jobId}.json`;
    downloadBlob(blob, fileNameFromDisposition(disposition, fallbackName));
  } catch (err) {
    setText("error-box", err.message);
  }
}

async function handleFileSelected() {
  const file = $("file").files[0];
  resetUploadedFile();
  resetUploadProgress();
  applyWorkflowMode();
  setText("file-label", file ? file.name : DEFAULT_FILE_LABEL);
  if ($("file-label")) {
    $("file-label").title = file ? file.name : "";
  }
  if (!file) {
    return;
  }
  if (file.size > FRONT_MAX_BYTES) {
    setText("error-box", "当前前端限制为 200MB 以内 PDF");
    setText("upload-status", "文件超出大小限制");
    $("upload-status")?.classList.remove("hidden");
    return;
  }
  setText("error-box", "-");
  setText("upload-status", "正在上传…");
  $("upload-status")?.classList.remove("hidden");

  try {
    const payload = await submitUploadRequest(
      `${apiBase()}${API_PREFIX}/uploads`,
      collectUploadFormData(file),
      setUploadProgress,
    );
    state.uploadId = payload.upload_id || "";
    state.uploadedFileName = payload.filename || file.name;
    state.uploadedPageCount = Number(payload.page_count || 0);
    state.uploadedBytes = Number(payload.bytes || file.size || 0);
    $("file")?.closest(".upload-tile")?.classList.toggle("is-ready", !!state.uploadId);
    $("file")?.closest(".upload-tile")?.classList.remove("is-uploading");
    setText("upload-status", `上传完成: ${state.uploadedFileName} | ${state.uploadedPageCount} 页 | ${(state.uploadedBytes / 1024 / 1024).toFixed(2)} MB`);
    $("upload-status")?.classList.remove("hidden");
    clearFileInputValue();
    refreshSubmitControls();
  } catch (err) {
    resetUploadedFile();
    clearFileInputValue();
    setText("error-box", err.message);
    setText("upload-status", "上传失败");
    $("upload-status")?.classList.remove("hidden");
    applyWorkflowMode();
  }
}

async function submitForm(event) {
  event.preventDefault();
  const workflow = currentWorkflow();
  if (state.desktopMode && !state.desktopConfigured && workflowNeedsCredentials(workflow)) {
    openSetupDialog();
    setText("error-box", "请先完成首次配置。");
    return;
  }
  if (workflowNeedsUpload(workflow) && !state.uploadId) {
    setText("error-box", "请先选择并上传 PDF 文件");
    return;
  }
  if (!workflowNeedsUpload(workflow) && !currentRenderSourceJobId()) {
    setText("error-box", "请先在开发者设置里填写 Render 源任务 ID。");
    return;
  }
  if (workflowNeedsCredentials(workflow) && !(await browserCredentialsFeature?.ensureMineruTokenReady({
    onMissingToken: () => {
      setText("error-box", "请先填写 MinerU Token。");
      if (!state.desktopMode) {
        browserCredentialsFeature?.openBrowserCredentialsDialog();
      }
    },
    onInvalidToken: (result) => {
      setText("error-box", result.summary || "MinerU Token 校验未通过。");
      if (!state.desktopMode) {
        browserCredentialsFeature?.openBrowserCredentialsDialog();
      }
    },
  }))) {
    return;
  }

  $("submit-btn").disabled = true;
  setText("error-box", "-");

  try {
    const runPayload = collectRunPayload();
    const payload = await submitJson(`${apiBase()}${API_PREFIX}/jobs`, runPayload);
    state.currentJobStartedAt = new Date().toISOString();
    state.currentJobFinishedAt = "";
    renderJob(payload);
    startPolling(payload.job_id);
  } catch (err) {
    setText("error-box", err.message);
  } finally {
    $("submit-btn").disabled = false;
  }
}


function renderPageRangeSummary() {
  const summary = $("page-range-summary");
  if (!summary) {
    return;
  }
  if (!workflowNeedsUpload()) {
    summary.classList.add("hidden");
    summary.textContent = "已选择页码：-";
    return;
  }
  const value = currentPageRanges();
  if (!value) {
    summary.classList.add("hidden");
    summary.textContent = "已选择页码：-";
    return;
  }
  summary.classList.remove("hidden");
  summary.textContent = `已选择页码：${value}`;
}

function openPageRangeDialog() {
  const applied = state.appliedPageRange || "";
  const [start = "", end = ""] = applied.includes("-") ? applied.split("-", 2) : [applied, applied];
  if ($("page-range-start")) {
    $("page-range-start").value = start || "";
  }
  if ($("page-range-end")) {
    $("page-range-end").value = end || "";
  }
  $("page-range-dialog")?.showModal();
}

function applyPageRanges() {
  const startInput = $("page-range-start");
  const endInput = $("page-range-end");
  const start = startInput?.value?.trim() || "";
  const end = endInput?.value?.trim() || "";
  if ((start && Number(start) < 1) || (end && Number(end) < 1)) {
    setText("error-box", "页码必须从 1 开始");
    return;
  }
  if (start && end && Number(start) > Number(end)) {
    setText("error-box", "起始页不能大于结束页");
    return;
  }
  if (startInput) {
    startInput.value = start;
  }
  if (endInput) {
    endInput.value = end;
  }
  state.appliedPageRange = normalizePageRangeValue(start, end);
  setText("error-box", "-");
  renderPageRangeSummary();
  $("page-range-dialog")?.close();
}

function clearPageRanges() {
  if ($("page-range-start")) {
    $("page-range-start").value = "";
  }
  if ($("page-range-end")) {
    $("page-range-end").value = "";
  }
  state.appliedPageRange = "";
  renderPageRangeSummary();
}

function activateDetailTab(name = "overview") {
  const tabs = document.querySelectorAll(".detail-tab");
  const panels = document.querySelectorAll(".detail-tab-panel");
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((panel) => {
    const active = panel.dataset.panel === name;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

function openStatusDetailDialog() {
  activateDetailTab("overview");
  $("status-detail-dialog")?.showModal();
}

function returnToHome() {
  stopPolling();
  $("status-detail-dialog")?.close();
  $("page-range-dialog")?.close();
  state.currentJobId = "";
  state.currentJobSnapshot = null;
  state.currentJobStartedAt = "";
  state.currentJobFinishedAt = "";
  state.appliedPageRange = "";
  setWorkflowSections(null);
  resetUploadProgress();
  resetUploadedFile();
  applyWorkflowMode();
  setText("job-summary", summarizeStatus("idle"));
  setText("job-stage-detail", "-");
  setText("job-id", "-");
  setText("query-job-duration", "-");
  setText("job-finished-at", "-");
  clearPageRanges();
  setText("runtime-current-stage", "-");
  setText("runtime-stage-elapsed", "-");
  setText("runtime-total-elapsed", "-");
  setText("runtime-retry-count", "0");
  setText("runtime-last-transition", "-");
  setText("runtime-terminal-reason", "-");
  setText("runtime-input-protocol", "-");
  setText("runtime-stage-spec-version", "-");
  setText("runtime-math-mode", "-");
  setText("status-detail-job-id", "-");
  setText("failure-summary", "-");
  setText("failure-category", "-");
  setText("failure-stage", "-");
  setText("failure-root-cause", "-");
  setText("failure-suggestion", "-");
  setText("failure-last-log-line", "-");
  setText("failure-retryable", "-");
  setText("events-status", "最近 50 条");
  $("events-empty")?.classList.remove("hidden");
  $("events-list")?.classList.add("hidden");
  if ($("events-list")) {
    $("events-list").innerHTML = "";
  }
  activateDetailTab("overview");
}

async function cancelCurrentJob() {
  const jobId = state.currentJobId;
  if (!jobId) {
    setText("error-box", "当前没有可取消的任务");
    return;
  }
  $("cancel-btn").disabled = true;
  try {
    await submitJson(`${apiBase()}${API_PREFIX}/jobs/${jobId}/cancel`, {});
    await fetchJob(jobId);
  } catch (err) {
    setText("error-box", err.message);
  }
}

async function handleDesktopSetupSave() {
  const mineruToken = $("setup-mineru-token").value.trim();
  const modelApiKey = $("setup-model-api-key").value.trim();
  if (!mineruToken || !modelApiKey) {
    setDesktopBusy("请先填写 MinerU Token 和 Model API Key。");
    return;
  }
  setDesktopBusy("正在保存配置并启动服务…");
  try {
    await saveDesktopConfig(mineruToken, modelApiKey, checkApiConnectivity);
    setDesktopBusy("");
  } catch (err) {
    setDesktopBusy(err.message || String(err));
  }
}

async function handleDesktopSettingsSave() {
  const mineruToken = $("settings-mineru-token").value.trim();
  const modelApiKey = $("settings-model-api-key").value.trim();
  if (!mineruToken || !modelApiKey) {
    setDesktopBusy("请先填写完整的 Key。");
    return;
  }
  setDesktopBusy("正在保存设置…");
  try {
    await saveDesktopConfig(mineruToken, modelApiKey, checkApiConnectivity);
    setDesktopBusy("");
  } catch (err) {
    setDesktopBusy(err.message || String(err));
  }
}

async function handleOpenOutputDir() {
  try {
    await desktopInvoke("open_output_directory");
  } catch (err) {
    setText("error-box", err.message || String(err));
  }
}

async function checkApiConnectivity() {
  try {
    const resp = await fetch(`${apiBase()}/health`);
    if (!resp.ok) {
      throw new Error(`health ${resp.status}`);
    }
  } catch (_err) {
    setText("error-box", `当前前端无法连接后端。API Base: ${apiBase()}。请确认本地服务已经启动，然后重试。`);
  }
}

function initializePage() {
  const browserStored = loadBrowserStoredConfig();
  state.developerConfig = loadDeveloperStoredConfig();
  applyKeyInputs(
    browserStored.mineruToken || defaultMineruToken(),
    browserStored.modelApiKey || defaultModelApiKey(),
  );
  browserCredentialsFeature = mountBrowserCredentialsFeature({
    state,
    applyKeyInputs,
    defaultMineruToken,
    defaultModelApiKey,
    defaultModelBaseUrl,
    openSettingsDialog,
    saveBrowserStoredConfig,
    validateMineruToken,
    onCredentialStateChange: applyWorkflowMode,
  });
  [
    "query-dialog",
    "developer-auth-dialog",
    "developer-dialog",
    "browser-credentials-dialog",
    "desktop-setup-dialog",
    "desktop-settings-dialog",
    "page-range-dialog",
    "status-detail-dialog",
  ].forEach(bindDialogBackdropClose);
  bindInfoBubbles();
  document.querySelector(".upload-tile")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    const fileInput = $("file");
    if (!fileInput || fileInput.disabled) {
      return;
    }
    fileInput.click();
  });
  $("file").addEventListener("click", prepareFilePicker);
  $("file").addEventListener("change", handleFileSelected);
  $("mineru_token").addEventListener("input", saveBrowserStoredConfig);
  $("api_key").addEventListener("input", saveBrowserStoredConfig);
  $("job-form").addEventListener("submit", submitForm);
  $("developer-btn")?.addEventListener("click", openDeveloperDialog);
  $("developer-auth-submit-btn")?.addEventListener("click", submitDeveloperAuth);
  $("developer-auth-password")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitDeveloperAuth();
    }
  });
  $("developer-save-btn")?.addEventListener("click", saveDeveloperDialog);
  $("developer-reset-btn")?.addEventListener("click", resetDeveloperDialog);
  $("developer-workflow")?.addEventListener("change", updateDeveloperWorkflowFormState);
  document.querySelectorAll("[data-developer-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateDeveloperTab(tab.dataset.developerTab || "model");
    });
  });
  $("page-range-btn")?.addEventListener("click", openPageRangeDialog);
  $("page-range-apply-btn")?.addEventListener("click", applyPageRanges);
  $("page-range-clear-btn")?.addEventListener("click", clearPageRanges);
  $("cancel-btn").addEventListener("click", cancelCurrentJob);
  $("stop-btn").addEventListener("click", stopPolling);
  $("status-detail-btn").addEventListener("click", openStatusDetailDialog);
  $("back-home-btn").addEventListener("click", returnToHome);
  $("download-btn").addEventListener("click", handleProtectedArtifactClick);
  $("markdown-bundle-btn")?.addEventListener("click", handleProtectedArtifactClick);
  $("pdf-btn").addEventListener("click", handleProtectedArtifactClick);
  $("markdown-btn").addEventListener("click", handleProtectedArtifactClick);
  $("markdown-raw-btn").addEventListener("click", handleProtectedArtifactClick);
  $("desktop-settings-btn").addEventListener("click", openSettingsDialog);
  $("desktop-settings-save-btn").addEventListener("click", handleDesktopSettingsSave);
  $("desktop-setup-save-btn").addEventListener("click", handleDesktopSetupSave);
  $("open-output-btn").addEventListener("click", handleOpenOutputDir);
  document.querySelectorAll(".detail-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateDetailTab(tab.dataset.tab || "overview");
    });
  });
  updateActionButtons(normalizeJobPayload({}));
  setWorkflowSections(null);
  setLinearProgress("job-progress-bar", "job-progress-text", NaN, NaN, "-");
  setText("job-summary", summarizeStatus("idle"));
  setText("job-stage-detail", "-");
  setText("query-job-duration", "-");
  setText("diagnostic-box", "-");
  setText("runtime-current-stage", "-");
  setText("runtime-stage-elapsed", "-");
  setText("runtime-total-elapsed", "-");
  setText("runtime-retry-count", "0");
  setText("runtime-last-transition", "-");
  setText("runtime-terminal-reason", "-");
  setText("runtime-input-protocol", "-");
  setText("runtime-stage-spec-version", "-");
  setText("runtime-math-mode", "-");
  setText("status-detail-job-id", "-");
  setText("failure-summary", "-");
  setText("failure-category", "-");
  setText("failure-stage", "-");
  setText("failure-root-cause", "-");
  setText("failure-suggestion", "-");
  setText("failure-last-log-line", "-");
  setText("failure-retryable", "-");
  setText("events-status", "最近 50 条");
  $("events-empty")?.classList.remove("hidden");
  $("events-list")?.classList.add("hidden");
  if ($("events-list")) {
    $("events-list").innerHTML = "";
  }
  activateDetailTab("overview");
  renderPageRangeSummary();
  resetUploadProgress();
  resetUploadedFile();
  applyWorkflowMode();
  updateJobWarning("idle");
  mountRecentJobsFeature({
    fetchJobList,
    apiPrefix: API_PREFIX,
    startPolling,
  });
}

export function initializeApp() {
  initializePage();
  if (isDesktopMode()) {
    bootstrapDesktop().catch((err) => {
      setText("error-box", err.message || String(err));
    });
  } else {
    checkApiConnectivity().catch(() => {});
    updateCredentialGate();
  }
}
