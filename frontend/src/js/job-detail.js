import { buildFrontendPageUrl, isMockMode } from "./config.js";
import { API_PREFIX } from "./constants.js";
import { $ } from "./dom.js";
import {
  fetchJobArtifactsManifest,
  fetchJobEvents,
  fetchJobMarkdown,
  fetchJobPayload,
  fetchProtected,
} from "./network.js";
import {
  collectMarkdownImageRefs,
  hasReadyManifestArtifact,
  resolveJobMarkdownContract,
  resolveMarkdownAssetUrl,
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

const JOB_EVENTS_PAGE_SIZE = 200;
const detailPageState = {
  job: null,
  manifestPayload: null,
  markdownPayload: null,
  markdownImageUrls: [],
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

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function summarizeArtifactLabel(key) {
  switch (`${key || ""}`.trim()) {
    case "source_pdf":
      return "源 PDF";
    case "translated_pdf":
      return "译后 PDF";
    case "typst_render_pdf":
      return "Typst 渲染 PDF";
    case "markdown_raw":
      return "Markdown Raw";
    case "markdown_images_dir":
      return "Markdown 图片目录";
    case "markdown_bundle_zip":
      return "Markdown Bundle";
    case "normalized_document_json":
      return "Normalized Document";
    case "normalization_report_json":
      return "Normalization Report";
    case "translation_manifest_json":
      return "Translation Manifest";
    case "translation_diagnostics_json":
      return "Translation Diagnostics";
    case "translation_debug_index_json":
      return "Translation Debug Index";
    case "provider_result_json":
      return "Provider Result";
    case "provider_bundle_zip":
      return "Provider Bundle";
    case "provider_raw_dir":
      return "Provider Raw Dir";
    case "pipeline_summary":
      return "Pipeline Summary";
    case "events_jsonl":
      return "Events JSONL";
    default:
      return `${key || "-"}`.trim() || "-";
  }
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

function formatSizeBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) {
    return "-";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function truncatePreview(value, maxChars = 4000) {
  const text = `${value || ""}`;
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n...（预览已截断）`;
}

function revokeMarkdownImageUrls() {
  for (const url of detailPageState.markdownImageUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch (_err) {
      // Ignore stale object URLs.
    }
  }
  detailPageState.markdownImageUrls = [];
}

function renderArtifactsManifest(manifestPayload) {
  const summary = $("detail-artifacts-summary");
  const container = $("detail-artifacts-list");
  if (!summary || !container) {
    return;
  }
  const items = Array.isArray(manifestPayload?.items) ? [...manifestPayload.items] : [];
  summary.textContent = items.length > 0 ? `共 ${items.length} 项` : "暂无已登记产物";
  if (items.length === 0) {
    container.innerHTML = '<div class="detail-empty">暂无产物清单</div>';
    return;
  }
  const preferredOrder = [
    "source_pdf",
    "translated_pdf",
    "pdf",
    "typst_render_pdf",
    "markdown_raw",
    "markdown_images_dir",
    "markdown_bundle_zip",
    "normalized_document_json",
    "normalization_report_json",
    "translation_manifest_json",
    "translation_diagnostics_json",
    "translation_debug_index_json",
    "provider_result_json",
    "provider_bundle_zip",
    "provider_raw_dir",
    "pipeline_summary",
    "events_jsonl",
  ];
  const orderMap = new Map(preferredOrder.map((key, index) => [key, index]));
  items.sort((left, right) => {
    const leftOrder = orderMap.has(left?.artifact_key) ? orderMap.get(left.artifact_key) : 999;
    const rightOrder = orderMap.has(right?.artifact_key) ? orderMap.get(right.artifact_key) : 999;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return `${left?.artifact_key || ""}`.localeCompare(`${right?.artifact_key || ""}`);
  });
  container.innerHTML = items.map((item) => {
    const resource = firstNonEmptyText(item?.resource_url, item?.resource_path, item?.relative_path) || "-";
    const readyLabel = item?.ready ? "ready" : "pending";
    const readyClass = item?.ready ? "is-ready" : "is-pending";
    const topLabel = summarizeArtifactLabel(item?.artifact_key);
    const metaBits = [
      firstNonEmptyText(item?.artifact_group) || "-",
      firstNonEmptyText(item?.artifact_kind) || "-",
      formatSizeBytes(item?.size_bytes),
    ];
    const extraBits = [
      firstNonEmptyText(item?.source_stage),
      firstNonEmptyText(item?.content_type),
    ].filter(Boolean);
    return `
      <article class="detail-artifact-row">
        <div class="detail-artifact-top">
          <div class="detail-artifact-key mono">${escapeHtml(topLabel)}</div>
          <span class="detail-artifact-chip ${readyClass}">${escapeHtml(readyLabel)}</span>
        </div>
        <div class="detail-artifact-meta">${escapeHtml(metaBits.join(" · "))}</div>
        ${extraBits.length ? `<div class="detail-artifact-meta">${escapeHtml(extraBits.join(" · "))}</div>` : ""}
        <div class="detail-artifact-meta mono">${escapeHtml(item?.artifact_key || "-")}</div>
        <div class="detail-artifact-meta mono">${escapeHtml(resource)}</div>
      </article>
    `;
  }).join("");
}

function renderMarkdownContract(job, markdownPayload = null) {
  const contract = resolveJobMarkdownContract(job);
  const markdownArtifact = job?.artifacts?.markdown || {};
  const rawUrl = firstNonEmptyText(
    markdownPayload?.raw_url,
    markdownPayload?.raw_path,
    markdownArtifact.raw_url,
    markdownArtifact.raw_path,
    job?.actions?.open_markdown_raw?.url,
    job?.actions?.open_markdown_raw?.path,
    contract.rawUrl,
  );
  const jsonUrl = firstNonEmptyText(
    markdownPayload?.json_url,
    markdownPayload?.json_path,
    markdownArtifact.json_url,
    markdownArtifact.json_path,
    job?.actions?.open_markdown?.url,
    job?.actions?.open_markdown?.path,
    contract.jsonUrl,
  );
  const imagesBaseUrl = firstNonEmptyText(
    markdownPayload?.images_base_url,
    markdownPayload?.images_base_path,
    markdownArtifact.images_base_url,
    markdownArtifact.images_base_path,
    job?.artifacts?.markdown_images_base_url,
    contract.imagesBaseUrl,
  );
  const content = typeof markdownPayload?.content === "string" ? markdownPayload.content : "";
  setText("detail-markdown-json-url", jsonUrl || "-");
  setText("detail-markdown-raw-url", rawUrl || "-");
  setText("detail-markdown-images-base-url", imagesBaseUrl || "-");
  setActionLink("detail-markdown-json-btn", jsonUrl, contract.ready && !!jsonUrl);
  setActionLink("detail-markdown-raw-btn", rawUrl, contract.ready && !!rawUrl);
  if (!contract.ready) {
    revokeMarkdownImageUrls();
    setText("detail-markdown-status", "当前任务没有已发布 Markdown");
    setText("detail-markdown-image-count", "0");
    setText("detail-markdown-preview", "-");
    const grid = $("detail-markdown-image-grid");
    grid?.classList.add("hidden");
    if (grid) {
      grid.innerHTML = "";
    }
    $("detail-markdown-image-empty")?.classList.remove("hidden");
    return;
  }
  if (!markdownPayload) {
    setText("detail-markdown-status", "已发布，正在读取内容…");
    return;
  }
  const refs = collectMarkdownImageRefs(content);
  const fileName = firstNonEmptyText(markdownPayload?.file_name, markdownArtifact.file_name);
  const sizeText = formatSizeBytes(markdownPayload?.size_bytes ?? markdownArtifact.size_bytes);
  const statusBits = ["已加载 /markdown JSON"];
  if (fileName) {
    statusBits.push(fileName);
  }
  if (sizeText !== "-") {
    statusBits.push(sizeText);
  }
  setText("detail-markdown-status", statusBits.join(" · "));
  setText("detail-markdown-image-count", `${refs.length}`);
  setText("detail-markdown-preview", truncatePreview(content));
}

async function renderMarkdownImagePreview(markdownPayload, imagesBaseUrl) {
  const grid = $("detail-markdown-image-grid");
  const empty = $("detail-markdown-image-empty");
  if (!grid || !empty) {
    return;
  }
  revokeMarkdownImageUrls();
  const refs = collectMarkdownImageRefs(markdownPayload?.content);
  if (refs.length === 0 || !imagesBaseUrl) {
    grid.innerHTML = "";
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  const previewRefs = refs.slice(0, 4);
  const previews = await Promise.all(previewRefs.map(async (ref) => {
    const absoluteUrl = resolveMarkdownAssetUrl(imagesBaseUrl, ref);
    if (!absoluteUrl) {
      return { ref, absoluteUrl: "", objectUrl: "", error: "无法解析图片地址" };
    }
    try {
      const resp = await fetchProtected(absoluteUrl);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      detailPageState.markdownImageUrls.push(objectUrl);
      return { ref, absoluteUrl, objectUrl, error: "" };
    } catch (error) {
      return { ref, absoluteUrl, objectUrl: "", error: error.message || "图片读取失败" };
    }
  }));
  grid.innerHTML = previews.map((item) => `
    <article class="detail-markdown-image-card">
      <div class="detail-artifact-meta mono">${escapeHtml(item.ref)}</div>
      ${item.objectUrl
        ? `<img class="detail-markdown-image" src="${escapeHtml(item.objectUrl)}" alt="${escapeHtml(item.ref)}" />`
        : `<div class="detail-empty">${escapeHtml(item.error || "图片不可用")}</div>`}
      <div class="detail-artifact-meta mono">${escapeHtml(item.absoluteUrl || "-")}</div>
    </article>
  `).join("");
  grid.classList.remove("hidden");
  empty.classList.add("hidden");
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
    const metaBits = [
      `#${item?.seq ?? "-"}`,
      formatEventTimestamp(item.ts),
      firstNonEmptyText(item?.stage_detail, item?.stage) || "-",
    ];
    const contextBits = [
      firstNonEmptyText(item?.provider),
      firstNonEmptyText(item?.provider_stage),
      firstNonEmptyText(item?.event_type),
    ].filter(Boolean);
    const statsBits = [];
    const progressCurrent = numberOrNull(item?.progress_current);
    const progressTotal = numberOrNull(item?.progress_total);
    if (progressCurrent !== null || progressTotal !== null) {
      statsBits.push(`progress ${progressCurrent ?? "-"} / ${progressTotal ?? "-"}`);
    }
    const retryCount = numberOrNull(item?.retry_count);
    if (retryCount !== null) {
      statsBits.push(`retry ${retryCount}`);
    }
    const elapsedMs = numberOrNull(item?.elapsed_ms);
    if (elapsedMs !== null) {
      statsBits.push(`elapsed ${formatRuntimeDuration(elapsedMs)}`);
    }
    return `
      <article class="detail-event-item">
        <div class="detail-event-top">
          <div class="detail-event-title">${escapeHtml(item.event || "-")}</div>
          <div class="detail-event-title">${escapeHtml(item.level || "-")}</div>
        </div>
        <div class="detail-event-meta">${escapeHtml(metaBits.join(" · "))}</div>
        ${contextBits.length ? `<div class="detail-event-meta">${escapeHtml(contextBits.join(" · "))}</div>` : ""}
        <div class="detail-event-meta">${escapeHtml(item.message || "-")}</div>
        ${statsBits.length ? `<div class="detail-event-meta">${escapeHtml(statsBits.join(" · "))}</div>` : ""}
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
  window.addEventListener("beforeunload", revokeMarkdownImageUrls, { once: true });
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
        `${markdownPayload.images_base_url || markdownPayload.images_base_path || resolveJobMarkdownContract(job).imagesBaseUrl || ""}`.trim(),
      );
    } else if (resolveJobMarkdownContract(job).ready) {
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
