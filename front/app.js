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
  $("job-id").textContent = payload.job_id || "-";
  $("job-type").textContent = payload.job_type || "-";
  $("job-stage").textContent = payload.stage || "-";
  $("job-stage-detail").textContent = payload.stage_detail || "-";
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
  $("error-box").textContent = payload.error || payload.result?.stderr || "-";
  $("raw-json").textContent = JSON.stringify(payload, null, 2);
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
    throw new Error(`读取任务失败: ${resp.status}`);
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
    $("raw-json").textContent = JSON.stringify(payload, null, 2);
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
  resetUploadProgress();
  resetUploadedFile();
  updateDeveloperVisibility();
  updateJobWarning("idle");
});
