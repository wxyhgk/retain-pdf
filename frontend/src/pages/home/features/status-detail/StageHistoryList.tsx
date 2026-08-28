// Danh sách timeline quá trình: viết lại JSX cho buildStageHistoryPresentation
// (nối template chuỗi) của src/js/status-detail/history.js, className/cấu trúc theo
// nguyên tác (phán quyết bản thiết kế §1.1: phần nối markup của history.js không dùng,
// đổi sang đọc mảng dữ liệu thô; thay thế assertion markup bằng assert từng mục).
//
// Tính toán thời lượng/timestamp dùng lại logic thuần đã giữ job/stage-history.js +
// status-detail/utils.js (giống tiền lệ EventsTimeline.jsx trang detail, không phát
// minh lại công thức phần này).

import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  isJobTerminal,
  resolveStageHistory,
  resolveStageHistoryDuration,
  stageHistoryDisplay,
} from "../../composition/external.js";

function StageHistoryItem({ entry, index, job, finishedAtFallback }) {
  const duration = resolveStageHistoryDuration(entry, job, { finishedAtFallback });
  const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
  const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "Đang diễn ra");
  const display = stageHistoryDisplay(entry);
  const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
  return (
    <article className="stage-history-item">
      <div className="stage-history-main">
        <span className="stage-history-index">{index + 1}</span>
        <div className="stage-history-copy">
          <div className="stage-history-title">{display.title}</div>
          {display.stage && display.stage !== display.title
            ? <div className="stage-history-stage">{display.stage}</div>
            : null}
          <div className="stage-history-meta">{`${enterAt} → ${exitAt}${terminalText}`}</div>
        </div>
      </div>
      <div className="stage-history-duration">{formatRuntimeDuration(duration)}</div>
    </article>
  );
}

export function StageHistoryList({ job, finishedAtFallback = "" }) {
  const history = resolveStageHistory(job);
  const hasItems = history.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.stageHistory;
  return (
    <>
      <div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>Không có bản ghi giai đoạn</div>
      <div id={ids.list} className={hasItems ? "stage-history-list" : "stage-history-list hidden"}>
        {history.map((entry, index) => (
          <StageHistoryItem
            key={`${index}-${entry?.stage || entry?.enter_at || ""}`}
            entry={entry}
            index={index}
            job={job}
            finishedAtFallback={finishedAtFallback}
          />
        ))}
      </div>
    </>
  );
}
