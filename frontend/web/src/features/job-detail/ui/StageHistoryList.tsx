// 过程时间线列表:src/js/status-detail/history.js 的 buildStageHistoryPresentation
// (字符串模板拼接)的 JSX 重写,类名/结构照搬(蓝图 §1.1 判决表:history.js
// markup 拼接部分不用,改读原始数据数组;逐条断言取代 markup 断言)。
//
// 耗时/时间戳计算复用 @retainpdf/domain/job + status-detail/utils.js
// (与 detail 页 EventsTimeline.jsx 的先例一致,不重新发明这部分公式)。

import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  isJobTerminal,
  resolveStageHistory,
  resolveStageHistoryDuration,
  stageHistoryDisplay,
} from "@retainpdf/domain/job";

function StageHistoryItem({ entry, index, job, finishedAtFallback }) {
  const duration = resolveStageHistoryDuration(entry, job, { finishedAtFallback });
  const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
  const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "进行中");
  const display = stageHistoryDisplay(entry);
  const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
  return (
    <article className="stage-history-item">
      <div className="stage-history-main">
        <span className="stage-history-index">{index + 1}</span>
        <div className="stage-history-copy">
          <div className="stage-history-heading">
            <div className="stage-history-title">{display.title}</div>
            {display.stage && display.stage !== display.title
              ? <div className="stage-history-stage">{display.stage}</div>
              : null}
          </div>
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
      <div id={ids.empty} className={hasItems ? "events-empty hidden" : "events-empty"}>暂无阶段记录</div>
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
