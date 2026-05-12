import { buildFrontendPageUrl, isMockMode } from "./config.js";
import { API_PREFIX } from "./constants.js";
import { $ } from "./dom.js";
import {
  fetchJobArtifactsManifest,
  fetchJobEvents,
  fetchJobMarkdown,
  fetchJobPayload,
  fetchProtected,
  rerunJob,
} from "./network.js";
import {
  hasReadyManifestArtifact,
} from "./job-artifacts.js";
import {
  formatEventTimestamp,
  formatJobFinishedAt,
  formatRuntimeDuration,
  isTerminalStatus,
  normalizeJobPayload,
  resolveJobActions,
  summarizeInvocationProtocol,
  summarizeInvocationSchemaVersion,
  summarizePublicError,
  summarizeRuntimeField,
  summarizeStageDetail,
  summarizeStatus,
} from "./job.js";
import {
  renderArtifactsManifest,
  renderMarkdownContract as renderMarkdownContractView,
  renderMarkdownImagePreview as renderMarkdownImagePreviewView,
  resolveMarkdownImagesBaseUrl,
  isMarkdownReady,
  revokeMarkdownImageUrls as revokeMarkdownImageUrlsView,
} from "./job-detail-artifacts.js";
import {
  bindDetailModalDismiss,
  closeAllDetailModals,
  setDetailActionLink,
  setDetailEventsStatus,
  setDetailText,
} from "./job-detail-view.js";
import {
  bindEventsLauncher,
  bindStageHistoryLauncher,
} from "./job-detail-events.js";

const detailPageState = {
  job: null,
  manifestPayload: null,
  markdownPayload: null,
  markdownImageUrls: [],
  eventsPayload: null,
  eventsLoadingPromise: null,
  rerunActionUrl: "",
};

function getJobIdFromQuery() {
  return new URLSearchParams(window.location.search).get("job_id")?.trim() || "";
}

function setText(id, value) {
  setDetailText(id, value);
}

function setActionLink(id, url, enabled) {
  setDetailActionLink(id, url, enabled);
}

function firstJobIdFromPayload(payload) {
  return firstNonEmptyText(
    payload?.job_id,
    payload?.data?.job_id,
    payload?.job?.job_id,
    payload?.job?.id,
    payload?.id,
  );
}

function buildReaderPageUrl(jobId) {
  const normalizedJobId = `${jobId || ""}`.trim();
  if (!normalizedJobId) {
    return "";
  }
  return buildFrontendPageUrl("./reader.html", {
    job_id: normalizedJobId,
  });
}

function parseIsoTime(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveLiveDurations(job) {
  const updatedAt = parseIsoTime(job.updated_at);
  const finishedAt = parseIsoTime(job.finished_at);
  const now = isTerminalStatus(job.status) ? finishedAt || updatedAt || new Date() : new Date();
  const stageStartedAt = parseIsoTime(job.stage_started_at || job.last_stage_transition_at);
  const jobStartedAt = parseIsoTime(job.started_at || job.created_at);
  const latestStage = Array.isArray(job.stage_history) && job.stage_history.length > 0
    ? job.stage_history[job.stage_history.length - 1]
    : null;
  const snapshotDeltaMs = !isTerminalStatus(job.status) && updatedAt
    ? Math.max(0, now.getTime() - updatedAt.getTime())
    : 0;
  let stageElapsedMs = Number(job.active_stage_elapsed_ms);
  let totalElapsedMs = Number(job.total_elapsed_ms);

  if (isTerminalStatus(job.status)) {
    if (!Number.isFinite(stageElapsedMs) && Number.isFinite(Number(latestStage?.duration_ms))) {
      stageElapsedMs = Number(latestStage.duration_ms);
    }
  } else if (Number.isFinite(stageElapsedMs)) {
    stageElapsedMs += snapshotDeltaMs;
  } else if (stageStartedAt) {
    stageElapsedMs = Math.max(0, now.getTime() - stageStartedAt.getTime());
  } else if (Number.isFinite(Number(latestStage?.duration_ms))) {
    stageElapsedMs = Number(latestStage.duration_ms) + snapshotDeltaMs;
  }
  if (isTerminalStatus(job.status)) {
    if (!Number.isFinite(totalElapsedMs) && jobStartedAt) {
      totalElapsedMs = Math.max(0, now.getTime() - jobStartedAt.getTime());
    }
  } else if (Number.isFinite(totalElapsedMs)) {
    totalElapsedMs += snapshotDeltaMs;
  } else if (jobStartedAt) {
    totalElapsedMs = Math.max(0, now.getTime() - jobStartedAt.getTime());
  }

  return {
    stageElapsedText: formatRuntimeDuration(stageElapsedMs),
    totalElapsedText: formatRuntimeDuration(totalElapsedMs),
  };
}

function summarizeMathMode(job) {
  const mathMode = `${job?.request_payload_math_mode || ""}`.trim();
  if (mathMode === "placeholder") {
    return "placeholder - 公式占位保护";
  }
  if (mathMode === "direct_typst") {
    return "direct_typst - 模型直出公式";
  }
  return mathMode || "-";
}

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function firstDefinedValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      return value;
    }
  }
  return "";
}

function stringifyDebugValue(value) {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}

function renderFailureDebugContext(job) {
  const container = $("detail-failure-debug-context");
  if (!container) {
    return;
  }
  const failure = job?.failure || {};
  const diagnostic = job?.failure_diagnostic || {};
  const rawDiagnostic = failure?.raw_diagnostic || diagnostic?.raw_diagnostic || {};
  const logTail = Array.isArray(job?.log_tail) ? job.log_tail.filter(Boolean).slice(-8) : [];
  const rows = [
    ["failed_stage", firstDefinedValue(failure.failed_stage, failure.stage, diagnostic.failed_stage, diagnostic.stage, job?.stage)],
    ["failure_code", firstDefinedValue(failure.failure_code, failure.code, diagnostic.failure_code, diagnostic.code)],
    ["failure_category", firstDefinedValue(failure.failure_category, failure.category, diagnostic.failure_category, diagnostic.category)],
    ["error_type", firstDefinedValue(failure.error_type, diagnostic.error_type, diagnostic.type, diagnostic.error_kind)],
    ["provider", firstDefinedValue(failure.provider, diagnostic.provider)],
    ["provider_stage", firstDefinedValue(failure.provider_stage, diagnostic.provider_stage)],
    ["provider_code", firstDefinedValue(failure.provider_code, diagnostic.provider_code)],
    ["upstream_host", firstDefinedValue(failure.upstream_host, diagnostic.upstream_host)],
    ["retryable", firstDefinedValue(failure.retryable, diagnostic.retryable)],
    ["raw_exception_type", firstDefinedValue(failure.raw_exception_type, diagnostic.raw_exception_type, rawDiagnostic.raw_exception_type)],
    ["raw_exception_message", firstDefinedValue(failure.raw_exception_message, diagnostic.raw_exception_message, rawDiagnostic.raw_exception_message)],
    ["raw_excerpt", firstDefinedValue(failure.raw_excerpt, diagnostic.raw_excerpt)],
    ["traceback", firstDefinedValue(failure.traceback, diagnostic.traceback, rawDiagnostic.traceback)],
    ["log_tail", logTail.length ? logTail.join("\n") : ""],
  ]
    .map(([label, value]) => [label, stringifyDebugValue(value)])
    .filter(([, value]) => value);

  if (!rows.length) {
    container.innerHTML = '<div class="detail-empty">暂无结构化失败上下文</div>';
    return;
  }
  container.innerHTML = rows.map(([label, value]) => `
    <div class="detail-debug-row">
      <div class="detail-debug-label">${escapeHtml(label)}</div>
      <pre class="detail-debug-value">${escapeHtml(value)}</pre>
    </div>
  `).join("");
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

function revokeMarkdownImageUrls() {
  revokeMarkdownImageUrlsView(detailPageState.markdownImageUrls);
}

function renderMarkdownContract(job, markdownPayload = null) {
  renderMarkdownContractView({
    job,
    markdownPayload,
    markdownImageUrls: detailPageState.markdownImageUrls,
    setText,
    setActionLink,
  });
}

async function renderMarkdownImagePreview(markdownPayload, imagesBaseUrl) {
  await renderMarkdownImagePreviewView({
    markdownPayload,
    imagesBaseUrl,
    markdownImageUrls: detailPageState.markdownImageUrls,
    fetchProtected,
  });
}

function bindModalDismiss(modalId, closeButtonId) {
  bindDetailModalDismiss(modalId, closeButtonId);
}

function bindDetailModals() {
  window.addEventListener("beforeunload", revokeMarkdownImageUrls, { once: true });
  bindModalDismiss("detail-stage-history-modal", "detail-close-stage-history-btn");
  bindModalDismiss("detail-events-modal", "detail-close-events-btn");
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    closeAllDetailModals();
  });
}

function setEventsStatus(text) {
  setDetailEventsStatus(text);
}

function bindProtectedDownloadLink(id, fallbackNameFactory) {
  $(id)?.addEventListener("click", async (event) => {
    const link = event.currentTarget;
    const enabled = link?.getAttribute("aria-disabled") !== "true";
    const url = `${link?.href || ""}`.trim();
    if (!enabled || !url || url.endsWith("#")) {
      event.preventDefault();
      return;
    }
    if (id === "detail-reader-btn") {
      return;
    }
    event.preventDefault();
    try {
      const resp = await fetchProtected(url);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`下载失败: ${resp.status} ${text || "unknown error"}`);
      }
      const blob = await resp.blob();
      const disposition = resp.headers.get("content-disposition") || "";
      const fallbackName = fallbackNameFactory(detailPageState.job?.job_id || "job");
      downloadBlob(blob, fileNameFromDisposition(disposition, fallbackName));
    } catch (error) {
      setText("detail-head-note", error.message || "下载失败");
    }
  });
}

function bindRerunButton() {
  $("detail-rerun-btn")?.addEventListener("click", async () => {
    const button = $("detail-rerun-btn");
    const actionUrl = `${detailPageState.rerunActionUrl || ""}`.trim();
    if (!button || !actionUrl) {
      setText("detail-rerun-status", "当前任务暂不可从断点恢复。");
      return;
    }
    button.disabled = true;
    setText("detail-rerun-status", "正在提交恢复任务...");
    try {
      const payload = await rerunJob(actionUrl);
      const nextJobId = firstJobIdFromPayload(payload);
      if (!nextJobId) {
        setText("detail-rerun-status", "恢复任务已提交，但响应中没有 job_id。");
        return;
      }
      setText("detail-rerun-status", `已创建恢复任务 ${nextJobId}，正在跳转...`);
      window.location.href = buildFrontendPageUrl("./detail.html", {
        job_id: nextJobId,
      });
    } catch (error) {
      setText("detail-rerun-status", error.message || String(error));
      button.disabled = false;
    }
  });
}

async function initializePage() {
  bindDetailModals();
  bindStageHistoryLauncher({ detailPageState });
  bindEventsLauncher({ detailPageState, fetchJobEvents });
  bindRerunButton();
  bindProtectedDownloadLink("detail-pdf-btn", (jobId) => `${jobId}.pdf`);
  bindProtectedDownloadLink("detail-markdown-raw-btn", (jobId) => `${jobId}.md`);
  bindProtectedDownloadLink("detail-markdown-json-btn", (jobId) => `${jobId}-markdown.json`);
  const jobId = getJobIdFromQuery();
  if (!jobId) {
    setText("detail-head-note", "缺少 job_id，请通过 detail.html?job_id=... 打开。");
    return;
  }
  setText("detail-job-id", jobId);
  setText("detail-head-note", isMockMode()
    ? "当前为 mock 明细页，可直接分享当前链接。"
    : "当前详情页可直接通过 URL 分享给其他人。");

  const [payloadRaw, manifestPayload] = await Promise.all([
    fetchJobPayload(jobId, API_PREFIX),
    fetchJobArtifactsManifest(jobId, API_PREFIX),
  ]);
  const job = normalizeJobPayload(payloadRaw);
  detailPageState.job = job;
  detailPageState.manifestPayload = manifestPayload;
  const durations = resolveLiveDurations(job);
  const actions = resolveJobActions(job);
  detailPageState.rerunActionUrl = actions.rerun;
  renderArtifactsManifest(manifestPayload);
  renderMarkdownContract(job, null);

  setText("detail-status-summary", summarizeStatus(job.status || "idle"));
  setText("detail-stage-detail", summarizeStageDetail(job));
  setText("detail-finished-at", formatJobFinishedAt(job));
  setText("detail-runtime-current-stage", summarizeRuntimeField(job.current_stage || job.stage_detail));
  setText("detail-runtime-stage-elapsed", durations.stageElapsedText);
  setText("detail-runtime-total-elapsed", durations.totalElapsedText);
  setText("detail-runtime-retry-count", `${job.retry_count ?? 0}`);
  setText("detail-runtime-last-transition", job.last_stage_transition_at ? formatEventTimestamp(job.last_stage_transition_at) : "-");
  setText("detail-runtime-terminal-reason", summarizeRuntimeField(job.terminal_reason));
  setText("detail-runtime-input-protocol", summarizeInvocationProtocol(job));
  setText("detail-runtime-stage-spec-version", summarizeInvocationSchemaVersion(job));
  setText("detail-runtime-math-mode", summarizeMathMode(job));

  const failure = job.failure || {};
  const failureDiagnostic = job.failure_diagnostic || {};
  const retryable = failure.retryable ?? failureDiagnostic.retryable;
  const failureLastLogLine = firstNonEmptyText(
    failure.last_log_line,
    failureDiagnostic.last_log_line,
    Array.isArray(job.log_tail) && job.log_tail.length ? job.log_tail[job.log_tail.length - 1] : "",
  );
  setText("detail-failure-summary", summarizeRuntimeField(failure.summary || job.final_failure_summary || failureDiagnostic.summary || failure.raw_excerpt));
  setText("detail-failure-category", summarizeRuntimeField(
    failure.category
    || failure.failure_category
    || job.final_failure_category
    || failureDiagnostic.type
    || failureDiagnostic.error_kind,
  ));
  setText("detail-failure-stage", summarizeRuntimeField(
    failure.stage
    || failure.failed_stage
    || failure.provider_stage
    || failureDiagnostic.stage
    || failureDiagnostic.failed_stage,
  ));
  setText("detail-failure-root-cause", summarizeRuntimeField(failure.root_cause || failureDiagnostic.root_cause || failure.upstream_host));
  setText("detail-failure-suggestion", summarizeRuntimeField(failure.suggestion || failureDiagnostic.suggestion || failure.failure_code));
  setText("detail-failure-last-log-line", summarizeRuntimeField(failureLastLogLine));
  setText("detail-failure-retryable", typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-");
  renderFailureDebugContext(job);
  const rerunEnabled = actions.rerunEnabled && !!actions.rerun;
  if ($("detail-rerun-btn")) {
    $("detail-rerun-btn").disabled = !rerunEnabled;
  }
  setText(
    "detail-rerun-status",
    rerunEnabled
      ? "后端支持从当前任务产物创建恢复任务。"
      : "当前任务暂不可从断点恢复。",
  );
  setText("detail-error-box", summarizePublicError(job));
  setEventsStatus("尚未加载");

  const readerEnabled = Boolean(
    job?.job_id
    && hasReadyManifestArtifact(manifestPayload, "source_pdf")
    && (hasReadyManifestArtifact(manifestPayload, "pdf")
      || hasReadyManifestArtifact(manifestPayload, "translated_pdf")
      || hasReadyManifestArtifact(manifestPayload, "result_pdf")
      || actions.pdfEnabled),
  );
  setActionLink("detail-reader-btn", buildReaderPageUrl(job.job_id), readerEnabled);
  setActionLink("detail-pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);

  try {
    const markdownPayload = await fetchJobMarkdown(jobId, API_PREFIX);
    detailPageState.markdownPayload = markdownPayload;
    renderMarkdownContract(job, markdownPayload);
    if (markdownPayload) {
      await renderMarkdownImagePreview(
        markdownPayload,
        resolveMarkdownImagesBaseUrl(job, markdownPayload),
      );
    } else if (isMarkdownReady(job)) {
      setText("detail-markdown-status", "Markdown 已标记 ready，但 /markdown 暂未返回内容");
    }
  } catch (error) {
    renderMarkdownContract(job, null);
    setText("detail-markdown-status", error.message || "读取 Markdown 失败");
  }
}

initializePage().catch((err) => {
  setText("detail-head-note", err.message || String(err));
});
