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
  fetchJobPayload,
  fetchProtected,
  submitJson,
  submitUploadRequest,
} from "./network.js";
import { state } from "./state.js";
import {
  clearFileInputValue,
  prepareFilePicker,
  renderJob,
  resetUploadProgress,
  resetUploadedFile,
  setLinearProgress,
  setStatus,
  setUploadProgress,
  updateActionButtons,
  updateJobWarning,
} from "./ui.js";

function stopPolling() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

async function fetchJob(jobId) {
  const payload = await fetchJobPayload(jobId, API_PREFIX);
  renderJob(payload);
  const job = normalizeJobPayload(payload);
  if (isTerminalStatus(job.status)) {
    stopPolling();
  }
}

function startPolling(jobId) {
  stopPolling();
  state.currentJobId = jobId;
  fetchJob(jobId).catch((err) => {
    $("error-box").textContent = err.message;
  });
  state.timer = setInterval(() => {
    fetchJob(jobId).catch((err) => {
      $("error-box").textContent = err.message;
    });
  }, 3000);
}

function collectUploadFormData(file) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

function collectRunPayload() {
  return {
    workflow: "mineru",
    upload_id: state.uploadId,
    mode: DEFAULT_MODE,
    model: defaultModelName(),
    base_url: defaultModelBaseUrl(),
    api_key: $("api_key").value || defaultModelApiKey(),
    workers: DEFAULT_WORKERS,
    batch_size: DEFAULT_BATCH_SIZE,
    classify_batch_size: DEFAULT_CLASSIFY_BATCH_SIZE,
    render_mode: DEFAULT_RENDER_MODE,
    compile_workers: DEFAULT_COMPILE_WORKERS,
    skip_title_translation: false,
    mineru_token: $("mineru_token").value || defaultMineruToken(),
    model_version: DEFAULT_MODEL_VERSION,
    language: DEFAULT_LANGUAGE,
    page_ranges: "",
    rule_profile_name: DEFAULT_RULE_PROFILE,
    custom_rules_text: "",
  };
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
  $("error-box").textContent = "-";

  try {
    const resp = await fetchProtected(url);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
    }

    const blob = await resp.blob();
    const disposition = resp.headers.get("content-disposition") || "";
    const jobId = $("job-id-input").value.trim() || state.currentJobId || "result";
    const fallbackName = link.id === "download-btn"
      ? `${jobId}.zip`
      : link.id === "pdf-btn"
        ? `${jobId}.pdf`
        : link.id === "markdown-raw-btn"
          ? `${jobId}.md`
          : `${jobId}.json`;
    downloadBlob(blob, fileNameFromDisposition(disposition, fallbackName));
  } catch (err) {
    $("error-box").textContent = err.message;
  }
}

async function handleFileSelected() {
  const file = $("file").files[0];
  resetUploadedFile();
  resetUploadProgress();
  $("file-label").textContent = file ? file.name : DEFAULT_FILE_LABEL;
  $("file-label").title = file ? file.name : "";
  if (!file) {
    return;
  }
  if (file.size > FRONT_MAX_BYTES) {
    $("error-box").textContent = "当前前端限制为 200MB 以内 PDF";
    $("upload-status").textContent = "文件超出大小限制";
    return;
  }
  $("error-box").textContent = "-";
  $("upload-status").textContent = "正在上传…";

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
    $("submit-btn").disabled = !state.uploadId;
    $("upload-status").textContent = `上传完成: ${state.uploadedFileName} | ${state.uploadedPageCount} 页 | ${(state.uploadedBytes / 1024 / 1024).toFixed(2)} MB`;
    clearFileInputValue();
  } catch (err) {
    resetUploadedFile();
    clearFileInputValue();
    $("error-box").textContent = err.message;
    $("upload-status").textContent = "上传失败";
  }
}

async function submitForm(event) {
  event.preventDefault();
  if (state.desktopMode && !state.desktopConfigured) {
    openSetupDialog();
    $("error-box").textContent = "请先完成首次配置。";
    return;
  }
  if (!state.uploadId) {
    $("error-box").textContent = "请先选择并上传 PDF 文件";
    return;
  }

  $("submit-btn").disabled = true;
  $("error-box").textContent = "-";

  try {
    const payload = await submitJson(`${apiBase()}${API_PREFIX}/jobs`, collectRunPayload());
    $("job-id").textContent = payload.job_id || "-";
    $("job-id-input").value = payload.job_id || "";
    setStatus(payload.status || "queued");
    $("job-summary").textContent = summarizeStatus(payload.status || "queued");
    $("job-stage-detail").textContent = payload.status === "queued" ? "任务已提交，等待后端开始处理。" : "-";
    $("job-finished-at").textContent = "-";
    $("query-job-finished-at").textContent = "-";
    $("query-job-duration").textContent = "-";
    updateActionButtons(normalizeJobPayload(payload));
    startPolling(payload.job_id);
  } catch (err) {
    $("error-box").textContent = err.message;
  } finally {
    $("submit-btn").disabled = false;
  }
}

function watchExistingJob() {
  const jobId = $("job-id-input").value.trim();
  if (!jobId) {
    $("error-box").textContent = "请输入 job_id";
    return;
  }
  startPolling(jobId);
}

async function cancelCurrentJob() {
  const jobId = $("job-id-input").value.trim() || state.currentJobId;
  if (!jobId) {
    $("error-box").textContent = "当前没有可取消的任务";
    return;
  }
  $("cancel-btn").disabled = true;
  try {
    await submitJson(`${apiBase()}${API_PREFIX}/jobs/${jobId}/cancel`, {});
    await fetchJob(jobId);
  } catch (err) {
    $("error-box").textContent = err.message;
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
    $("error-box").textContent = err.message || String(err);
  }
}

async function checkApiConnectivity() {
  try {
    const resp = await fetch(`${apiBase()}/health`);
    if (!resp.ok) {
      throw new Error(`health ${resp.status}`);
    }
  } catch (_err) {
    $("error-box").textContent = `当前前端无法连接后端。API Base: ${apiBase()}。请确认本地服务已经启动，然后重试。`;
  }
}

function initializePage() {
  const browserStored = loadBrowserStoredConfig();
  applyKeyInputs(
    browserStored.mineruToken || defaultMineruToken(),
    browserStored.modelApiKey || defaultModelApiKey(),
  );
  $("file").addEventListener("click", prepareFilePicker);
  $("file").addEventListener("change", handleFileSelected);
  $("mineru_token").addEventListener("input", saveBrowserStoredConfig);
  $("api_key").addEventListener("input", saveBrowserStoredConfig);
  $("job-form").addEventListener("submit", submitForm);
  $("watch-btn").addEventListener("click", watchExistingJob);
  $("cancel-btn").addEventListener("click", cancelCurrentJob);
  $("stop-btn").addEventListener("click", stopPolling);
  $("download-btn").addEventListener("click", handleProtectedArtifactClick);
  $("pdf-btn").addEventListener("click", handleProtectedArtifactClick);
  $("markdown-btn").addEventListener("click", handleProtectedArtifactClick);
  $("markdown-raw-btn").addEventListener("click", handleProtectedArtifactClick);
  $("desktop-settings-btn").addEventListener("click", openSettingsDialog);
  $("desktop-settings-save-btn").addEventListener("click", handleDesktopSettingsSave);
  $("desktop-setup-save-btn").addEventListener("click", handleDesktopSetupSave);
  $("open-output-btn").addEventListener("click", handleOpenOutputDir);
  updateActionButtons(normalizeJobPayload({}));
  setLinearProgress("job-progress-bar", "job-progress-text", NaN, NaN, "-");
  $("job-summary").textContent = summarizeStatus("idle");
  $("job-stage-detail").textContent = "-";
  $("query-job-finished-at").textContent = "-";
  $("query-job-duration").textContent = "-";
  $("diagnostic-box").textContent = "-";
  resetUploadProgress();
  resetUploadedFile();
  updateJobWarning("idle");
}

export function initializeApp() {
  initializePage();
  if (isDesktopMode()) {
    bootstrapDesktop().catch((err) => {
      $("error-box").textContent = err.message || String(err);
    });
  } else {
    checkApiConnectivity().catch(() => {});
  }
}
