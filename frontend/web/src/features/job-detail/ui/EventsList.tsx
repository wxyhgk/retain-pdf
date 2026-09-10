// 事件流列表:src/js/status-detail/events.js 的 buildEventsPresentation
// (字符串模板拼接)的 JSX 重写,类名/结构照搬(蓝图 §1.1 判决表:events.js
// markup 拼接部分不用,改读原始数据数组;逐条断言取代 markup 断言)。
//
// tone 判定 + 排序规则从 events.js 原样照搬(与 detail 页 EventsTimeline.jsx
// 的 formatEventPayload 先例一致,小函数直接拷贝进组件文件,不新增一层
// model.js——旧文件本身不可 import,拷贝面很小)。

import { useState } from "react";
import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";
import {
  formatEventTimestamp,
} from "@retainpdf/domain/job";
import {
  normalizedStageEventRecord,
} from "@retainpdf/domain/job-status";

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

function EventItem({ item }) {
  const [payloadOpen, setPayloadOpen] = useState(false);
  const record = normalizedStageEventRecord(item);
  const tone = eventBadgeTone(item);
  const payloadText = formatEventPayload(item.payload);
  const title = record.stageText || item.message || "-";
  const showProgress = record.progressText && record.progressText !== title;
  return (
    <article className="event-item">
      <div className="event-meta">
        <span className={`event-badge${tone ? ` ${tone}` : ""}`}>{item.event || "-"}</span>
        <span>{formatEventTimestamp(record.timestamp)}</span>
        <span>{record.displayStage || record.rawStage || "-"}</span>
        {record.substage ? <span>{record.substage}</span> : null}
        {record.lane && record.lane !== "main" ? <span>{`lane:${record.lane}`}</span> : null}
        <span>{item.level || "-"}</span>
      </div>
      <div className="event-title">{title}</div>
      {showProgress ? <div className="event-progress">{record.progressText}</div> : null}
      {payloadText ? (
        <details className="event-payload-wrap" open={payloadOpen} onToggle={(event) => setPayloadOpen(event.currentTarget.open)}>
          <summary className="event-payload-toggle">查看 payload</summary>
          <pre className="event-payload">{payloadText}</pre>
        </details>
      ) : null}
    </article>
  );
}

export function EventsList({ eventsPayload }) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  // 文案承诺"按时间倒序",这里显式排序,不依赖后端返回顺序(照搬 events.js)
  const entries = items
    .map((item) => ({ item, record: normalizedStageEventRecord(item) }))
    .sort((a, b) => (Date.parse(b.record.timestamp) || 0) - (Date.parse(a.record.timestamp) || 0));
  const hasItems = items.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.events;
  return (
    <>
      <div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>暂无事件</div>
      <div id={ids.list} className={hasItems ? "events-list" : "events-list hidden"}>
        {entries.map(({ item }, index) => (
          // 排序后位次前缀保证唯一——不能只用 item.seq/event_id(mock/真实数据都
          // 观测到部分事件缺这两个字段,退回 index 会和"确实带 seq"的条目撞键)。
          <EventItem key={`${index}-${item?.seq ?? item?.event_id ?? ""}`} item={item} />
        ))}
      </div>
    </>
  );
}

export function eventsStatusText(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  return items.length > 0 ? `最近 ${items.length} 条` : "暂无事件";
}
