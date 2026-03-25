const DEVELOPER_PASSWORD = "Gk265157!";

const state = {
  timer: null,
  currentJobId: "",
  developerUnlocked: false,
  uploadId: "",
  uploadedFileName: "",
  uploadedPageCount: 0,
  uploadedBytes: 0,
};

const $ = (id) => document.getElementById(id);

const artifactsOrder = [
  "job_root",
  "source_pdf",
  "layout_json",
  "translations_dir",
  "output_pdf",
  "summary",
];

const BUILTIN_RULE_PROFILES = [
  { name: "general_sci", label: "general_sci" },
  { name: "software_manual", label: "software_manual" },
  { name: "computational_chemistry", label: "computational_chemistry" },
];

function apiBase() {
  return $("api-base").value.trim().replace(/\/$/, "");
}

function defaultApiBase() {
  const host = window.location.hostname || "127.0.0.1";
  return `http://${host}:40000`;
}

function setStatus(status) {
  const el = $("job-status");
  el.textContent = status || "idle";
  el.className = `badge ${status || "idle"}`;
}

function safeJsonClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function redactCommandArray(command) {
  if (!Array.isArray(command)) {
    return command;
  }
  const redacted = [...command];
  for (let i = 0; i < redacted.length; i += 1) {
    if (redacted[i] === "--api-key" || redacted[i] === "--mineru-token") {
      if (i + 1 < redacted.length) {
        redacted[i + 1] = "***";
      }
    }
  }
  return redacted;
}

function redactSensitive(value) {
  if (Array.isArray(value)) {
    return redactCommandArray(value).map((item) => redactSensitive(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const cloned = {};
  for (const [key, raw] of Object.entries(value)) {
    if (["api_key", "mineru_token"].includes(key)) {
      cloned[key] = raw ? "***" : "";
      continue;
    }
    if (key === "command" && Array.isArray(raw)) {
      cloned[key] = redactCommandArray(raw);
      continue;
    }
    cloned[key] = redactSensitive(raw);
  }
  return cloned;
}

function summarizeStatus(status) {
  switch (status) {
    case "queued":
      return "任务已提交，等待后端开始处理。";
    case "running":
      return "任务正在处理中，请等待当前阶段完成。";
    case "succeeded":
      return "任务已完成，可以下载结果。";
    case "failed":
      return "任务已失败，可重试或进入开发者模式查看内部细节。";
    default:
      return "等待提交任务。";
  }
}

function summarizeStageDetail(payload) {
  const detail = (payload.stage_detail || "").trim();
  if (detail) {
    return detail;
  }
  switch (payload.status) {
    case "queued":
      return "排队中";
    case "running":
      return "后端正在处理当前文档";
    case "succeeded":
      return "处理完成";
    case "failed":
      return "处理失败";
    default:
      return "-";
  }
}

function summarizePublicError(payload) {
  if (payload.status === "failed") {
    return "任务失败。可重试；如需定位内部原因，请进入开发者模式查看详细日志。";
  }
  if (payload.error) {
    return "任务返回了错误信息。请稍后重试；如需内部细节，请进入开发者模式查看。";
  }
  return "-";
}

function setDownloadLink(jobId, enabled) {
  const el = $("download-btn");
  el.href = enabled && jobId ? `${apiBase()}/v1/jobs/${jobId}/download` : "#";
  el.classList.toggle("disabled", !enabled);
}

function renderArtifacts(artifacts = {}) {
  const root = $("artifacts");
  root.innerHTML = "";
  for (const key of artifactsOrder) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = artifacts[key] ?? "-";
    wrapper.appendChild(dt);
    wrapper.appendChild(dd);
    root.appendChild(wrapper);
  }
}

function setLinearProgress(barId, textId, current, total, fallbackText = "-") {
  const bar = $(barId);
  const text = $(textId);
  const hasNumbers = Number.isFinite(current) && Number.isFinite(total) && total > 0;
  if (!hasNumbers) {
    bar.style.width = "0%";
    text.textContent = fallbackText;
    return;
  }
  const percent = Math.max(0, Math.min(100, (current / total) * 100));
  bar.style.width = `${percent}%`;
  text.textContent = `${current} / ${total} (${percent.toFixed(0)}%)`;
}

function setUploadProgress(loaded, total) {
  const panel = $("upload-progress-panel");
  panel.classList.remove("hidden");
  const hasNumbers = Number.isFinite(loaded) && Number.isFinite(total) && total > 0;
  const percent = hasNumbers ? Math.max(0, Math.min(100, (loaded / total) * 100)) : 0;
  $("upload-progress-bar").style.width = `${percent}%`;
  $("upload-progress-text").textContent = hasNumbers ? `${percent.toFixed(0)}%` : "上传中";
}

function resetUploadProgress() {
  $("upload-progress-panel").classList.add("hidden");
  $("upload-progress-bar").style.width = "0%";
  $("upload-progress-text").textContent = "0%";
}

function resetUploadedFile() {
  state.uploadId = "";
  state.uploadedFileName = "";
  state.uploadedPageCount = 0;
  state.uploadedBytes = 0;
  $("submit-btn").disabled = true;
  $("upload-status").textContent = "未上传文件";
  $("file-label").title = "";
}

function updateDeveloperVisibility() {
  const visible = !!state.developerUnlocked;
  $("developer-log-panel").classList.toggle("hidden", !visible);
  $("developer-details-panel").classList.toggle("hidden", !visible);
}

function updateJobWarning(status) {
  const active = status === "queued" || status === "running";
  $("job-warning").classList.toggle("hidden", !active);
}

function renderJob(payload) {
  const sanitizedPayload = redactSensitive(safeJsonClone(payload));
  $("job-id").textContent = payload.job_id || "-";
  $("job-type").textContent = payload.job_type || "-";
  $("job-stage").textContent = payload.stage || "-";
  $("job-stage-raw-detail").textContent = payload.stage_detail || "-";
  $("job-summary").textContent = summarizeStatus(payload.status || "idle");
  $("job-stage-detail").textContent = summarizeStageDetail(payload);
  $("job-id-input").value = payload.job_id || "";
  setStatus(payload.status || "idle");
  setLinearProgress(
    "job-progress-bar",
    "job-progress-text",
    Number(payload.progress_current),
    Number(payload.progress_total),
    "-",
  );
  $("log-tail").textContent = Array.isArray(payload.log_tail) && payload.log_tail.length
    ? payload.log_tail.join("\n")
    : "-";
  $("error-box").textContent = summarizePublicError(payload);
  $("raw-json").textContent = JSON.stringify(sanitizedPayload, null, 2);
  renderArtifacts(payload.artifacts || {});
  setDownloadLink(payload.job_id, payload.status === "succeeded");
  updateJobWarning(payload.status || "idle");
}

function stopPolling() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

async function fetchJob(jobId) {
  const resp = await fetch(`${apiBase()}/v1/jobs/${jobId}`);
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error("未找到该任务，请检查 job_id 是否正确。");
    }
    throw new Error(`读取任务失败，请稍后重试。(${resp.status})`);
  }
  const payload = await resp.json();
  renderJob(payload);
  if (payload.status === "succeeded" || payload.status === "failed") {
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

function appendIfPresent(form, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  form.append(key, value);
}

function collectUploadFormData(file) {
  const form = new FormData();
  form.append("file", file);
  form.append("developer_mode", state.developerUnlocked ? "true" : "false");
  return form;
}

function collectRunPayload() {
  return {
    upload_id: state.uploadId,
    mode: $("mode").value,
    model: $("model").value.trim(),
    base_url: $("base_url").value.trim(),
    api_key: $("api_key").value,
    workers: Number($("workers").value || "0"),
    batch_size: Number($("batch_size").value || "6"),
    classify_batch_size: Number($("classify_batch_size").value || "12"),
    render_mode: $("render_mode").value,
    compile_workers: Number($("compile_workers").value || "0"),
    skip_title_translation: $("skip_title_translation").checked,
    mineru_token: $("mineru_token").value,
    model_version: $("model_version").value,
    language: $("language").value.trim(),
    page_ranges: $("page_ranges").value.trim(),
    rule_profile_name: $("rule_profile_name").value,
    custom_rules_text: $("custom_rules_text").value,
  };
}

function submitUploadRequest(url, form) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setUploadProgress(event.loaded, event.total);
      } else {
        setUploadProgress(NaN, NaN);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
        return;
      }
      const message = typeof xhr.response === "object" && xhr.response
        ? JSON.stringify(xhr.response)
        : (xhr.responseText || "");
      reject(new Error(`提交失败: ${xhr.status} ${message}`));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("提交失败: 网络错误"));
    });

    xhr.send(form);
  });
}

async function submitJson(url, payload) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`提交失败: ${resp.status} ${text}`);
  }
  return resp.json();
}

async function handleFileSelected() {
  const file = $("file").files[0];
  $("file-label").textContent = file ? file.name : "点击选择文件或拖到这里";
  resetUploadedFile();
  resetUploadProgress();
  $("file-label").title = file ? file.name : "";
  if (!file) {
    return;
  }
  if (!state.developerUnlocked && file.size > 10 * 1024 * 1024) {
    $("error-box").textContent = "普通用户仅支持 10MB 以内 PDF";
    $("upload-status").textContent = "文件超出普通用户大小限制";
    return;
  }
  $("error-box").textContent = "-";
  $("upload-status").textContent = "正在上传…";

  try {
    const payload = await submitUploadRequest(`${apiBase()}/v1/uploads/pdf`, collectUploadFormData(file));
    state.uploadId = payload.upload_id || "";
    state.uploadedFileName = payload.filename || file.name;
    state.uploadedPageCount = Number(payload.page_count || 0);
    state.uploadedBytes = Number(payload.bytes || file.size || 0);
    $("submit-btn").disabled = !state.uploadId;
    $("upload-status").textContent = `上传完成: ${state.uploadedFileName} | ${state.uploadedPageCount} 页 | ${(state.uploadedBytes / 1024 / 1024).toFixed(2)} MB`;
  } catch (err) {
    resetUploadedFile();
    $("error-box").textContent = err.message;
    $("upload-status").textContent = "上传失败";
  }
}

async function submitForm(event) {
  event.preventDefault();
  if (!state.uploadId) {
    $("error-box").textContent = "请先选择并上传 PDF 文件";
    return;
  }

  $("submit-btn").disabled = true;
  $("error-box").textContent = "-";

  try {
    const payload = await submitJson(`${apiBase()}/v1/run-uploaded-mineru-case`, collectRunPayload());
    $("job-id").textContent = payload.job_id || "-";
    $("job-id-input").value = payload.job_id || "";
    setStatus(payload.status || "queued");
    $("job-summary").textContent = summarizeStatus(payload.status || "queued");
    $("job-stage-detail").textContent = payload.status === "queued" ? "任务已提交，等待后端开始处理。" : "-";
    $("raw-json").textContent = JSON.stringify(redactSensitive(safeJsonClone(payload)), null, 2);
    setDownloadLink(payload.job_id, false);
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

function openDeveloperAccess() {
  if (state.developerUnlocked) {
    $("developer-dialog").showModal();
    return;
  }
  $("developer-password").value = "";
  $("developer-auth-error").classList.add("hidden");
  $("developer-auth-dialog").showModal();
}

function submitDeveloperPassword() {
  if ($("developer-password").value === DEVELOPER_PASSWORD) {
    state.developerUnlocked = true;
    updateDeveloperVisibility();
    $("developer-auth-dialog").close();
    $("developer-dialog").showModal();
    return;
  }
  $("developer-auth-error").classList.remove("hidden");
}

async function loadRuleProfiles() {
  const select = $("rule_profile_name");
  const current = select.value;
  try {
    const resp = await fetch(`${apiBase()}/v1/rule-profiles`);
    if (!resp.ok) {
      throw new Error("load failed");
    }
    const items = await resp.json();
    const options = Array.isArray(items) && items.length
      ? items.map((item) => ({
        name: item.name,
        label: item.name + (item.built_in ? " (builtin)" : ""),
      }))
      : BUILTIN_RULE_PROFILES;
    select.innerHTML = "";
    for (const item of options) {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.label;
      if (item.name === current) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    if (![...select.options].some((option) => option.selected) && select.options.length) {
      select.options[0].selected = true;
    }
  } catch (_err) {
    select.innerHTML = "";
    for (const item of BUILTIN_RULE_PROFILES) {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.label;
      if (item.name === current) {
        option.selected = true;
      }
      select.appendChild(option);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!$("api-base").value.trim()) {
    $("api-base").value = defaultApiBase();
  }
  $("file").addEventListener("change", handleFileSelected);
  $("developer-btn").addEventListener("click", openDeveloperAccess);
  $("developer-auth-submit-btn").addEventListener("click", submitDeveloperPassword);
  $("developer-password").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitDeveloperPassword();
    }
  });
  $("job-form").addEventListener("submit", submitForm);
  $("watch-btn").addEventListener("click", watchExistingJob);
  $("stop-btn").addEventListener("click", stopPolling);
  renderArtifacts({});
  setDownloadLink("", false);
  setLinearProgress("job-progress-bar", "job-progress-text", NaN, NaN, "-");
  $("job-summary").textContent = summarizeStatus("idle");
  $("job-stage-detail").textContent = "-";
  resetUploadProgress();
  resetUploadedFile();
  updateDeveloperVisibility();
  updateJobWarning("idle");
  loadRuleProfiles().catch(() => {});
});
