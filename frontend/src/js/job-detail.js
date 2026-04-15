import { apiBase, buildApiHeaders, buildFrontendPageUrl, isMockMode } from "./config.js";
import { API_PREFIX } from "./constants.js";
import { $ } from "./dom.js";
import {
  fetchJobArtifactsManifest,
  fetchJobEvents,
  fetchJobPayload,
} from "./network.js";
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

const JOB_EVENTS_PAGE_SIZE = 200;
const detailPageState = {
  job: null,
  manifestPayload: null,
  eventsPayload: null,
  eventsLoadingPromise: null,
};

function getJobIdFromQuery() {
  return new URLSearchParams(window.location.search).get("job_id")?.trim() || "";
}

function setText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value ?? "-";
  }
}

function setActionLink(id, url, enabled) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.href = enabled && url ? url : "#";
  el.classList.toggle("disabled", !enabled);
  el.setAttribute("aria-disabled", enabled ? "false" : "true");
}

function resolveManifestArtifactUrl(manifestPayload, artifactKey) {
  const items = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];
  const item = items.find((entry) => entry?.artifact_key === artifactKey && entry?.ready);
  return `${item?.resource_url || item?.resource_path || ""}`.trim();
}

function hasManifestArtifact(manifestPayload, artifactKey) {
  const items = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];
  return items.some((entry) => entry?.artifact_key === artifactKey && entry?.ready);
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
  let stageElapsedMs = Number(job.active_stage_elapsed_ms);
  let totalElapsedMs = Number(job.total_elapsed_ms);

  if (!Number.isFinite(stageElapsedMs) && stageStartedAt) {
    stageElapsedMs = Math.max(0, now.getTime() - stageStartedAt.getTime());
  }
  if (!Number.isFinite(totalElapsedMs) && jobStartedAt) {
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

function summarizeStageName(stage, detail) {
  const detailText = `${detail || ""}`.trim();
  return detailText || `${stage || "-"}`.trim() || "-";
}

function resolveStageHistoryDuration(entry, job) {
  const explicit = Number(entry?.duration_ms);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  const enterAt = parseIsoTime(entry?.enter_at);
  const exitAt = parseIsoTime(entry?.exit_at);
  if (enterAt && exitAt) {
    return Math.max(0, exitAt.getTime() - enterAt.getTime());
  }
  if (enterAt && !exitAt) {
    const endAt = isTerminalStatus(job.status)
      ? parseIsoTime(job.finished_at || job.updated_at)
      : new Date();
    if (endAt) {
      return Math.max(0, endAt.getTime() - enterAt.getTime());
    }
  }
  return NaN;
}

function formatEventPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch (_err) {
    return "";
  }
}

function renderStageHistory(job) {
  const list = $("detail-stage-history-list");
  const empty = $("detail-stage-history-empty");
  if (!list || !empty) {
    return;
  }
  const history = Array.isArray(job.stage_history) ? job.stage_history : [];
  if (history.length === 0) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = history.map((entry, index) => {
    const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
    const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isTerminalStatus(job.status) ? "-" : "进行中");
    const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
    return `
      <article class="detail-stage-item">
        <div class="detail-stage-top">
          <div class="detail-stage-title">${index + 1}. ${escapeHtml(summarizeStageName(entry?.stage, entry?.detail))}</div>
          <div class="detail-stage-title">${escapeHtml(formatRuntimeDuration(resolveStageHistoryDuration(entry, job)))}</div>
        </div>
        <div class="detail-stage-meta">${escapeHtml(enterAt)} → ${escapeHtml(exitAt)}${escapeHtml(terminalText)}</div>
      </article>
    `;
  }).join("");
}

function renderEvents(eventsPayload) {
  const list = $("detail-events-list");
  const empty = $("detail-events-empty");
  const status = $("detail-events-status");
  if (!list || !empty || !status) {
    return;
  }
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  status.textContent = items.length > 0 ? `全部事件 · ${items.length} 条` : "全部事件";
  if (items.length === 0) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = items.map((item) => {
    const payloadText = formatEventPayload(item.payload);
    return `
      <article class="detail-event-item">
        <div class="detail-event-top">
          <div class="detail-event-title">${escapeHtml(item.event || "-")}</div>
          <div class="detail-event-title">${escapeHtml(item.level || "-")}</div>
        </div>
        <div class="detail-event-meta">${escapeHtml(formatEventTimestamp(item.ts))} · ${escapeHtml(item.stage || "-")}</div>
        <div class="detail-event-meta">${escapeHtml(item.message || "-")}</div>
        ${payloadText ? `<pre class="detail-event-payload">${escapeHtml(payloadText)}</pre>` : ""}
      </article>
    `;
  }).join("");
}

function setModalOpen(modalId, open) {
  const modal = $(modalId);
  if (!modal) {
    return;
  }
  modal.classList.toggle("hidden", !open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
  const hasOpenModal = ["detail-stage-history-modal", "detail-events-modal"].some((id) => !$(id)?.classList.contains("hidden"));
  document.body.style.overflow = hasOpenModal ? "hidden" : "";
}

function bindModalDismiss(modalId, closeButtonId) {
  $(closeButtonId)?.addEventListener("click", () => {
    setModalOpen(modalId, false);
  });
  $(modalId)?.addEventListener("click", (event) => {
    if (event.target === $(modalId)) {
      setModalOpen(modalId, false);
    }
  });
}

async function fetchAllJobEvents(jobId) {
  const items = [];
  let offset = 0;
  while (true) {
    const payload = await fetchJobEvents(jobId, API_PREFIX, JOB_EVENTS_PAGE_SIZE, offset);
    const batch = Array.isArray(payload?.items) ? payload.items : [];
    items.push(...batch);
    if (batch.length < JOB_EVENTS_PAGE_SIZE) {
      return {
        ...payload,
        items,
        offset: 0,
        limit: items.length,
      };
    }
    offset += batch.length;
  }
}

function bindDetailModals() {
  bindModalDismiss("detail-stage-history-modal", "detail-close-stage-history-btn");
  bindModalDismiss("detail-events-modal", "detail-close-events-btn");
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    setModalOpen("detail-stage-history-modal", false);
    setModalOpen("detail-events-modal", false);
  });
}

function bindStageHistoryLauncher() {
  $("detail-open-stage-history-btn")?.addEventListener("click", () => {
    if (detailPageState.job) {
      renderStageHistory(detailPageState.job);
    }
    setModalOpen("detail-stage-history-modal", true);
  });
}

function setEventsStatus(text) {
  const status = $("detail-events-status");
  if (status) {
    status.textContent = text;
  }
}

async function ensureEventsLoaded() {
  if (detailPageState.eventsPayload) {
    setEventsStatus(`全部事件 · ${Array.isArray(detailPageState.eventsPayload.items) ? detailPageState.eventsPayload.items.length : 0} 条`);
    renderEvents(detailPageState.eventsPayload);
    return detailPageState.eventsPayload;
  }
  if (!detailPageState.job?.job_id) {
    throw new Error("缺少 job_id，无法加载事件流。");
  }
  if (!detailPageState.eventsLoadingPromise) {
    setEventsStatus("正在加载全部事件...");
    detailPageState.eventsLoadingPromise = fetchAllJobEvents(detailPageState.job.job_id)
      .then((payload) => {
        detailPageState.eventsPayload = payload;
        renderEvents(payload);
        return payload;
      })
      .catch((error) => {
        setEventsStatus(error.message || "读取事件流失败。");
        throw error;
      })
      .finally(() => {
        detailPageState.eventsLoadingPromise = null;
      });
  }
  return detailPageState.eventsLoadingPromise;
}

function bindEventsLauncher() {
  $("detail-open-events-btn")?.addEventListener("click", async () => {
    setModalOpen("detail-events-modal", true);
    try {
      await ensureEventsLoaded();
      $("detail-open-events-btn").textContent = "查看";
    } catch (_error) {
      // Status text already updated in ensureEventsLoaded.
    }
  });
}

async function initializePage() {
  bindDetailModals();
  bindStageHistoryLauncher();
  bindEventsLauncher();
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
  setText("detail-failure-summary", summarizeRuntimeField(failure.summary || job.final_failure_summary || failureDiagnostic.summary));
  setText("detail-failure-category", summarizeRuntimeField(failure.category || job.final_failure_category || failureDiagnostic.type || failureDiagnostic.error_kind));
  setText("detail-failure-stage", summarizeRuntimeField(failure.stage || failureDiagnostic.stage || failureDiagnostic.failed_stage));
  setText("detail-failure-root-cause", summarizeRuntimeField(failure.root_cause || failureDiagnostic.root_cause));
  setText("detail-failure-suggestion", summarizeRuntimeField(failure.suggestion || failureDiagnostic.suggestion));
  setText("detail-failure-last-log-line", summarizeRuntimeField(failure.last_log_line || failureDiagnostic.last_log_line));
  setText("detail-failure-retryable", typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-");
  setText("detail-error-box", summarizePublicError(job));
  setEventsStatus("尚未加载");

  const readerEnabled = Boolean(
    job?.job_id
    && hasManifestArtifact(manifestPayload, "source_pdf")
    && (hasManifestArtifact(manifestPayload, "pdf")
      || hasManifestArtifact(manifestPayload, "translated_pdf")
      || hasManifestArtifact(manifestPayload, "result_pdf")
      || actions.pdfEnabled),
  );
  setActionLink("detail-reader-btn", buildReaderPageUrl(job.job_id), readerEnabled);
  setActionLink("detail-pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);
}

initializePage().catch((err) => {
  setText("detail-head-note", err.message || String(err));
});
