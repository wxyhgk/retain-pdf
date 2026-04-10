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

function setText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value;
  }
}

function setMineruValidationMessage(message, tone = "") {
  const el = $("browser-mineru-validation");
  if (!el) {
    return;
  }
  const content = `${message || ""}`.trim();
  el.textContent = content || "保存前会自动检测 MinerU Token。";
  el.classList.toggle("hidden", !content);
  el.classList.toggle("is-valid", tone === "valid");
  el.classList.toggle("is-error", tone === "error");
}

function setDeepSeekValidationMessage(message, tone = "") {
  const el = $("browser-deepseek-validation");
  if (!el) {
    return;
  }
  const content = `${message || ""}`.trim();
  el.textContent = content || "可检测 DeepSeek 接口是否连通。";
  el.classList.toggle("hidden", !content);
  el.classList.toggle("is-valid", tone === "valid");
  el.classList.toggle("is-error", tone === "error");
}

function resetMineruValidationCache() {
  state.validatedMineruToken = "";
  state.mineruValidationStatus = "";
}

async function runMineruTokenValidation(token, { showResult = true } = {}) {
  const mineruToken = `${token || ""}`.trim();
  if (!mineruToken) {
    resetMineruValidationCache();
    if (showResult) {
      setMineruValidationMessage("请先填写 MinerU Token。", "error");
    }
    return { ok: false, status: "unauthorized" };
  }
  if (showResult) {
    setMineruValidationMessage("正在检测 MinerU Token…");
  }
  try {
    const result = await validateMineruToken(API_PREFIX, {
      mineru_token: mineruToken,
      base_url: "https://mineru.net",
      model_version: DEFAULT_MODEL_VERSION,
    });
    state.validatedMineruToken = mineruToken;
    state.mineruValidationStatus = result.status || "";
    if (showResult) {
      const hint = result.operator_hint ? ` ${result.operator_hint}` : "";
      const message = result.summary || `MinerU Token 检测结果：${result.status || "unknown"}`;
      setMineruValidationMessage(`${message}${hint}`.trim(), result.ok ? "valid" : "error");
    }
    return result;
  } catch (_err) {
    resetMineruValidationCache();
    if (showResult) {
      setMineruValidationMessage("MinerU Token 检测失败，请稍后重试。", "error");
    }
    return {
      ok: false,
      status: "network_error",
      summary: "MinerU Token 检测失败，请稍后重试。",
    };
  }
}

async function ensureMineruTokenReady() {
  const token = ($("mineru_token").value || defaultMineruToken()).trim();
  if (!token) {
    setText("error-box", "请先填写 MinerU Token。");
    if (!state.desktopMode) {
      openBrowserCredentialsDialog();
      setMineruValidationMessage("请先填写 MinerU Token。", "error");
    }
    return false;
  }
  if (state.validatedMineruToken === token && state.mineruValidationStatus === "valid") {
    return true;
  }
  const result = await runMineruTokenValidation(token, { showResult: !state.desktopMode });
  if (result.ok) {
    return true;
  }
  setText("error-box", result.summary || "MinerU Token 校验未通过。");
  if (!state.desktopMode) {
    openBrowserCredentialsDialog();
  }
  return false;
}

async function runDeepSeekConnectivityCheck(apiKey, { showResult = true } = {}) {
  const modelApiKey = `${apiKey || ""}`.trim();
  if (!modelApiKey) {
    if (showResult) {
      setDeepSeekValidationMessage("请先填写 DeepSeek Key。", "error");
    }
    return { ok: false, status: 0 };
  }
  if (showResult) {
    setDeepSeekValidationMessage("正在检测 DeepSeek 接口…");
  }
  const baseUrl = defaultModelBaseUrl().replace(/\/$/, "");
  try {
    const resp = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${modelApiKey}`,
      },
    });
    if (resp.ok) {
      if (showResult) {
        setDeepSeekValidationMessage("DeepSeek 接口连接成功。", "valid");
      }
      return { ok: true, status: resp.status };
    }
    const summary = resp.status === 401
      ? "DeepSeek Key 无效或已过期。"
      : `DeepSeek 接口返回 ${resp.status}。`;
    if (showResult) {
      setDeepSeekValidationMessage(summary, "error");
    }
    return { ok: false, status: resp.status, summary };
  } catch (_err) {
    if (showResult) {
      setDeepSeekValidationMessage("DeepSeek 接口检测失败，请检查网络或浏览器跨域限制。", "error");
    }
    return { ok: false, status: 0 };
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
    model: saved.model || defaultModelName(),
    baseUrl: saved.baseUrl || defaultModelBaseUrl(),
    workers: Number(saved.workers || DEFAULT_WORKERS),
    batchSize: Number(saved.batchSize || DEFAULT_BATCH_SIZE),
    classifyBatchSize: Number(saved.classifyBatchSize || DEFAULT_CLASSIFY_BATCH_SIZE),
    compileWorkers: Number(saved.compileWorkers || DEFAULT_COMPILE_WORKERS),
    timeoutSeconds: Number(saved.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS),
  };
}

function parseGlossaryText(rawText = "") {
  const lines = `${rawText || ""}`.split(/\r?\n/);
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    let parts = [];
    if (rawLine.includes("\t")) {
      parts = rawLine.split("\t").map((item) => item.trim());
    } else if (line.includes("->")) {
      parts = line.split("->").map((item) => item.trim());
    } else if (line.includes("=>")) {
      parts = line.split("=>").map((item) => item.trim());
    } else {
      parts = line.split(/\s+/).map((item) => item.trim());
    }
    parts = parts.filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`术语表第 ${index + 1} 行格式无效。请使用“源词<TAB>目标词”或“源词 -> 目标词”。`);
    }
    const [source, target, ...rest] = parts;
    entries.push({
      source,
      target,
      note: rest.join(" ").trim(),
    });
  }
  return entries;
}

function syncDeveloperDialogFromState() {
  const config = developerConfigWithDefaults();
  $("developer-model").value = config.model;
  $("developer-base-url").value = config.baseUrl;
  $("developer-workers").value = `${config.workers}`;
  $("developer-batch-size").value = `${config.batchSize}`;
  $("developer-classify-batch-size").value = `${config.classifyBatchSize}`;
  $("developer-compile-workers").value = `${config.compileWorkers}`;
  $("developer-timeout-seconds").value = `${config.timeoutSeconds}`;
}

function openDeveloperDialog() {
  syncDeveloperDialogFromState();
  activateDeveloperTab("model");
  $("developer-dialog")?.showModal();
}

function saveDeveloperDialog() {
  state.developerConfig = {
    model: $("developer-model")?.value?.trim() || defaultModelName(),
    baseUrl: $("developer-base-url")?.value?.trim() || defaultModelBaseUrl(),
    workers: Number($("developer-workers")?.value || DEFAULT_WORKERS),
    batchSize: Number($("developer-batch-size")?.value || DEFAULT_BATCH_SIZE),
    classifyBatchSize: Number($("developer-classify-batch-size")?.value || DEFAULT_CLASSIFY_BATCH_SIZE),
    compileWorkers: Number($("developer-compile-workers")?.value || DEFAULT_COMPILE_WORKERS),
    timeoutSeconds: Number($("developer-timeout-seconds")?.value || DEFAULT_TIMEOUT_SECONDS),
  };
  saveDeveloperStoredConfig(state.developerConfig);
  $("developer-dialog")?.close();
}

function resetDeveloperDialog() {
  state.developerConfig = {};
  saveDeveloperStoredConfig({});
  syncDeveloperDialogFromState();
}

function clearGlossaryInput() {
  const input = $("glossary-input");
  if (input) {
    input.value = "";
  }
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

function collectRunPayload() {
  const pageRanges = currentPageRanges();
  const developerConfig = developerConfigWithDefaults();
  const glossaryEntries = parseGlossaryText($("glossary-input")?.value || "");
  return {
    workflow: "mineru",
    source: {
      upload_id: state.uploadId,
    },
    ocr: {
      provider: "mineru",
      mineru_token: $("mineru_token").value || defaultMineruToken(),
      model_version: DEFAULT_MODEL_VERSION,
      language: DEFAULT_LANGUAGE,
      page_ranges: pageRanges,
    },
    translation: {
      mode: DEFAULT_MODE,
      model: developerConfig.model,
      base_url: developerConfig.baseUrl,
      api_key: $("api_key").value || defaultModelApiKey(),
      workers: developerConfig.workers,
      batch_size: developerConfig.batchSize,
      classify_batch_size: developerConfig.classifyBatchSize,
      rule_profile_name: DEFAULT_RULE_PROFILE,
      custom_rules_text: "",
      glossary_entries: glossaryEntries,
      skip_title_translation: false,
    },
    render: {
      render_mode: DEFAULT_RENDER_MODE,
      compile_workers: developerConfig.compileWorkers,
    },
    runtime: {
      timeout_seconds: developerConfig.timeoutSeconds,
    },
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
    $("submit-btn").disabled = !state.uploadId;
    $("upload-action-slot")?.classList.toggle("hidden", !state.uploadId);
    $("file")?.closest(".upload-tile")?.classList.toggle("is-ready", !!state.uploadId);
    $("file")?.closest(".upload-tile")?.classList.remove("is-uploading");
    setText("upload-status", `上传完成: ${state.uploadedFileName} | ${state.uploadedPageCount} 页 | ${(state.uploadedBytes / 1024 / 1024).toFixed(2)} MB`);
    $("upload-status")?.classList.remove("hidden");
    clearFileInputValue();
  } catch (err) {
    resetUploadedFile();
    clearFileInputValue();
    setText("error-box", err.message);
    setText("upload-status", "上传失败");
    $("upload-status")?.classList.remove("hidden");
  }
}

async function submitForm(event) {
  event.preventDefault();
  if (state.desktopMode && !state.desktopConfigured) {
    openSetupDialog();
    setText("error-box", "请先完成首次配置。");
    return;
  }
  if (!state.uploadId) {
    setText("error-box", "请先选择并上传 PDF 文件");
    return;
  }
  if (!(await ensureMineruTokenReady())) {
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

function openQueryDialog() {
  if (!state.recentJobsDate) {
    state.recentJobsDate = new Date().toLocaleDateString("en-CA");
  }
  if ($("recent-jobs-date")) {
    $("recent-jobs-date").value = state.recentJobsDate;
  }
  loadRecentJobs({ reset: true });
  $("query-dialog")?.showModal();
}

function recentJobStatusLabel(status) {
  switch (`${status || ""}`.trim()) {
    case "queued":
      return "排队中";
    case "running":
      return "进行中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "canceled":
      return "已取消";
    default:
      return status || "-";
  }
}

async function openRecentJob(jobId) {
  if (!jobId) {
    return;
  }
  $("query-dialog")?.close();
  startPolling(jobId);
}

function recentJobDateKey(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function truncateRecentJobName(value) {
  const text = `${value || ""}`.trim();
  if (!text) {
    return "-";
  }
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}

async function loadRecentJobs({ reset = false } = {}) {
  const list = $("recent-jobs-list");
  const empty = $("recent-jobs-empty");
  const loadMoreButton = $("load-more-jobs-btn");
  if (!list || !empty || !loadMoreButton) {
    return;
  }
  if (reset) {
    state.recentJobsOffset = 0;
    state.recentJobsHasMore = true;
    empty.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = '<div class="events-empty">正在加载最近任务…</div>';
    loadMoreButton.classList.add("hidden");
  } else {
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "加载中…";
  }
  try {
    const selectedDate = state.recentJobsDate || new Date().toLocaleDateString("en-CA");
    const pageSize = 5;
    const collected = [];
    let reachedOlderDate = false;

    if (reset) {
      while (collected.length < pageSize && !reachedOlderDate) {
        const payload = await fetchJobList(API_PREFIX, { limit: pageSize, offset: state.recentJobsOffset });
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (items.length === 0) {
          state.recentJobsHasMore = false;
          break;
        }
        state.recentJobsOffset += items.length;
        let startedMatchingDate = false;
        for (const item of items) {
          const dateKey = recentJobDateKey(item.updated_at || item.created_at);
          if (!dateKey) {
            continue;
          }
          if (dateKey > selectedDate) {
            continue;
          }
          if (dateKey === selectedDate) {
            startedMatchingDate = true;
            collected.push(item);
            if (collected.length >= pageSize) {
              break;
            }
            continue;
          }
          if (dateKey < selectedDate) {
            reachedOlderDate = true;
            break;
          }
        }
        if (items.length < pageSize) {
          state.recentJobsHasMore = false;
          break;
        }
      }
    } else {
      const payload = await fetchJobList(API_PREFIX, { limit: pageSize, offset: state.recentJobsOffset });
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (items.length === 0) {
        state.recentJobsHasMore = false;
      } else {
        collected.push(...items);
        state.recentJobsOffset += items.length;
        state.recentJobsHasMore = items.length === pageSize;
      }
    }

    if (reset && collected.length === 0) {
      list.innerHTML = "";
      list.classList.add("hidden");
      empty.textContent = "所选日期暂无任务";
      empty.classList.remove("hidden");
      state.recentJobsHasMore = false;
      loadMoreButton.classList.add("hidden");
      return;
    }
    if (!reset && collected.length === 0) {
      state.recentJobsHasMore = false;
      loadMoreButton.classList.add("hidden");
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "更多";
      return;
    }
    const markup = collected.map((item) => `
      <button type="button" class="recent-job-item" data-job-id="${item.job_id || ""}">
        <div class="recent-job-top">
          <span class="recent-job-id" title="${(item.display_name || item.job_id || "-").replaceAll('"', "&quot;")}">${truncateRecentJobName(item.display_name || item.job_id || "-")}</span>
          <span class="recent-job-status">${recentJobStatusLabel(item.status)}</span>
        </div>
        <div class="recent-job-meta">
          <span>阶段: ${item.stage || "-"}</span>
          <span>更新: ${item.updated_at || "-"}</span>
        </div>
      </button>
    `).join("");
    list.classList.remove("hidden");
    empty.classList.add("hidden");
    list.innerHTML = reset ? markup : `${list.innerHTML}${markup}`;
    if (reset) {
      state.recentJobsHasMore = state.recentJobsHasMore !== false;
    }
    loadMoreButton.classList.toggle("hidden", !state.recentJobsHasMore);
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = "更多";
    list.querySelectorAll(".recent-job-item").forEach((button) => {
      button.addEventListener("click", () => {
        openRecentJob(button.dataset.jobId || "");
      });
    });
  } catch (err) {
    if (reset) {
      list.innerHTML = "";
      list.classList.add("hidden");
      empty.textContent = err.message || "读取最近任务失败";
      empty.classList.remove("hidden");
    } else {
      loadMoreButton.classList.add("hidden");
      state.recentJobsHasMore = false;
    }
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = "更多";
  }
}

function renderPageRangeSummary() {
  const summary = $("page-range-summary");
  if (!summary) {
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

function browserCredentialElements() {
  return {
    dialog: $("browser-credentials-dialog"),
    mineruInput: $("browser-mineru-token"),
    apiKeyInput: $("browser-api-key"),
    trigger: $("credentials-btn"),
  };
}

function syncBrowserDialogFromHiddenInputs() {
  const { mineruInput, apiKeyInput } = browserCredentialElements();
  if (mineruInput) {
    mineruInput.value = $("mineru_token").value || "";
  }
  if (apiKeyInput) {
    apiKeyInput.value = $("api_key").value || "";
  }
  setMineruValidationMessage("", "");
  setDeepSeekValidationMessage("", "");
}

function persistBrowserCredentialsFromDialog() {
  const { mineruInput, apiKeyInput } = browserCredentialElements();
  applyKeyInputs(
    mineruInput?.value?.trim() || "",
    apiKeyInput?.value?.trim() || "",
  );
  saveBrowserStoredConfig();
}

function hasBrowserCredentials() {
  return Boolean(($("mineru_token").value || "").trim() && ($("api_key").value || "").trim());
}

function updateCredentialGate() {
  const trigger = $("credentials-btn");
  const gate = $("credential-gate");
  const tile = $("file")?.closest(".upload-tile");
  const fileInput = $("file");
  const uploadGlyph = $("upload-glyph");
  const fileLabel = $("file-label");
  const uploadHelp = $("upload-help");
  const uploadMeta = document.querySelector(".upload-meta");
  const uploadStatus = $("upload-status");

  if (!gate || !tile || !fileInput || state.desktopMode) {
    return;
  }
  const show = !hasBrowserCredentials();
  gate.classList.toggle("hidden", !show);
  trigger?.classList.toggle("is-nudged", show);
  tile.classList.toggle("is-locked", show);
  fileInput.disabled = show;
  uploadGlyph?.classList.toggle("hidden", show);
  fileLabel?.classList.toggle("hidden", show);
  uploadHelp?.classList.toggle("hidden", show);
  uploadMeta?.classList.toggle("hidden", show);
  if (show) {
    uploadStatus?.classList.add("hidden");
  }
  $("submit-btn").disabled = show || !state.uploadId;
  $("upload-action-slot")?.classList.toggle("hidden", show || !state.uploadId);
  tile.classList.toggle("is-ready", !show && !!state.uploadId);
}

function openBrowserCredentialsDialog() {
  const { dialog } = browserCredentialElements();
  if (!dialog) {
    return;
  }
  syncBrowserDialogFromHiddenInputs();
  dialog.showModal();
}

async function handleBrowserCredentialValidate() {
  const { mineruInput, apiKeyInput } = browserCredentialElements();
  await Promise.all([
    runMineruTokenValidation(mineruInput?.value || "", { showResult: true }),
    runDeepSeekConnectivityCheck(apiKeyInput?.value || "", { showResult: true }),
  ]);
}

async function handleBrowserMineruValidate() {
  const { mineruInput } = browserCredentialElements();
  await runMineruTokenValidation(mineruInput?.value || "", { showResult: true });
}

async function handleBrowserDeepSeekValidate() {
  const { apiKeyInput } = browserCredentialElements();
  await runDeepSeekConnectivityCheck(apiKeyInput?.value || "", { showResult: true });
}

async function handleBrowserCredentialSave() {
  const { mineruInput } = browserCredentialElements();
  const validation = await runMineruTokenValidation(mineruInput?.value || "", { showResult: true });
  if (!validation.ok) {
    return;
  }
  persistBrowserCredentialsFromDialog();
  updateCredentialGate();
  $("browser-credentials-dialog")?.close();
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
  [
    "query-dialog",
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
  $("glossary-clear-btn")?.addEventListener("click", clearGlossaryInput);
  $("developer-btn")?.addEventListener("click", openDeveloperDialog);
  $("open-query-btn").addEventListener("click", openQueryDialog);
  $("developer-save-btn")?.addEventListener("click", saveDeveloperDialog);
  $("developer-reset-btn")?.addEventListener("click", resetDeveloperDialog);
  document.querySelectorAll("[data-developer-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateDeveloperTab(tab.dataset.developerTab || "model");
    });
  });
  $("refresh-jobs-btn")?.addEventListener("click", () => loadRecentJobs({ reset: true }));
  $("load-more-jobs-btn")?.addEventListener("click", () => loadRecentJobs({ reset: false }));
  $("recent-jobs-date")?.addEventListener("change", (event) => {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      state.recentJobsDate = target.value || new Date().toLocaleDateString("en-CA");
      loadRecentJobs({ reset: true });
    }
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
  $("credentials-btn")?.addEventListener("click", () => {
    if (state.desktopMode) {
      openSettingsDialog();
      return;
    }
    openBrowserCredentialsDialog();
  });
  $("browser-mineru-token")?.addEventListener("input", () => {
    resetMineruValidationCache();
    setMineruValidationMessage("", "");
  });
  $("browser-api-key")?.addEventListener("input", () => {
    setDeepSeekValidationMessage("", "");
  });
  $("browser-mineru-validate-btn")?.addEventListener("click", handleBrowserMineruValidate);
  $("browser-deepseek-validate-btn")?.addEventListener("click", handleBrowserDeepSeekValidate);
  $("browser-credentials-save-btn")?.addEventListener("click", handleBrowserCredentialSave);
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
  updateJobWarning("idle");
  updateCredentialGate();
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
