const state = {
  timer: null,
  currentJobId: "",
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
  el.href = enabled ? `${apiBase()}/v1/jobs/${jobId}/download` : "#";
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

function renderJob(payload) {
  $("job-id").textContent = payload.job_id || "-";
  $("job-type").textContent = payload.job_type || "-";
  $("job-id-input").value = payload.job_id || "";
  setStatus(payload.status || "idle");
  $("error-box").textContent = payload.error || payload.result?.stderr || "-";
  $("raw-json").textContent = JSON.stringify(payload, null, 2);
  renderArtifacts(payload.artifacts || {});
  setDownloadLink(payload.job_id, payload.status === "succeeded");
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

async function submitForm(event) {
  event.preventDefault();
  const file = $("file").files[0];
  if (!file) {
    $("error-box").textContent = "请选择 PDF 文件";
    return;
  }

  const form = new FormData();
  form.append("file", file);
  form.append("mode", $("mode").value);
  form.append("model", $("model").value.trim());
  form.append("base_url", $("base_url").value.trim());
  form.append("api_key", $("api_key").value);
  form.append("workers", $("workers").value);
  form.append("batch_size", $("batch_size").value);
  form.append("render_mode", $("render_mode").value);
  form.append("skip_title_translation", $("skip_title_translation").checked ? "true" : "false");
  form.append("mineru_token", $("mineru_token").value);
  form.append("model_version", $("model_version").value);
  form.append("language", $("language").value.trim());
  form.append("page_ranges", $("page_ranges").value.trim());

  $("submit-btn").disabled = true;
  $("error-box").textContent = "-";

  try {
    const resp = await fetch(`${apiBase()}/v1/run-mineru-case-upload`, {
      method: "POST",
      body: form,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`提交失败: ${resp.status} ${text}`);
    }
    const payload = await resp.json();
    $("job-id").textContent = payload.job_id;
    $("job-id-input").value = payload.job_id;
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

document.addEventListener("DOMContentLoaded", () => {
  if (!$("api-base").value.trim()) {
    $("api-base").value = defaultApiBase();
  }
  $("file").addEventListener("change", () => {
    const file = $("file").files[0];
    $("file-label").textContent = file ? file.name : "点击选择文件或拖到这里";
  });
  $("developer-btn").addEventListener("click", () => {
    $("developer-dialog").showModal();
  });
  $("job-form").addEventListener("submit", submitForm);
  $("watch-btn").addEventListener("click", watchExistingJob);
  $("stop-btn").addEventListener("click", stopPolling);
  renderArtifacts({});
  setDownloadLink("", false);
});
