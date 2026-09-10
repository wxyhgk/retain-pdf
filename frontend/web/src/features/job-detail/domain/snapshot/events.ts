import { escapeHtml, formatEventTimestamp } from "./utils.js";
import { normalizedStageEventRecord } from "@retainpdf/domain/job-status";

function eventBadgeTone(item) {
  if (item.level === "error" || item.event === "failure_classified" || item.event === "job_terminal") {
    return "error";
  }
  if (item.level === "warn" || item.event === "retry_scheduled") {
    return "warn";
  }
  return "";
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

export function buildEventsPresentation(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  // 文案承诺“按时间倒序”,这里显式排序,不依赖后端返回顺序
  const entries = items
    .map((item) => ({ item, record: normalizedStageEventRecord(item) }))
    .sort((a, b) => (Date.parse(b.record.timestamp) || 0) - (Date.parse(a.record.timestamp) || 0));
  const markup = entries.map(({ item, record }) => {
    const tone = eventBadgeTone(item);
    const payloadText = formatEventPayload(item.payload);
    const title = record.stageText || item.message || "-";
    return `
      <article class="event-item">
        <div class="event-meta">
          <span class="event-badge ${tone}">${escapeHtml(item.event || "-")}</span>
          <span>${formatEventTimestamp(record.timestamp)}</span>
          <span>${escapeHtml(record.displayStage || record.rawStage || "-")}</span>
          ${record.substage ? `<span>${escapeHtml(record.substage)}</span>` : ""}
          ${record.lane && record.lane !== "main" ? `<span>lane:${escapeHtml(record.lane)}</span>` : ""}
          <span>${escapeHtml(item.level || "-")}</span>
        </div>
        <div class="event-title">${escapeHtml(title)}</div>
        ${record.progressText && record.progressText !== title ? `<div class="event-progress">${escapeHtml(record.progressText)}</div>` : ""}
        ${payloadText ? `
          <details class="event-payload-wrap">
            <summary class="event-payload-toggle">查看 payload</summary>
            <pre class="event-payload">${escapeHtml(payloadText)}</pre>
          </details>
        ` : ""}
      </article>
    `;
  }).join("");
  return {
    markup,
    count: items.length,
    emptyText: "暂无事件",
    hasItems: items.length > 0,
  };
}
