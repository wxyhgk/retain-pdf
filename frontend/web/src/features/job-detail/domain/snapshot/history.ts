import {
  escapeHtml,
  formatEventTimestamp,
  formatRuntimeDuration,
  isJobTerminal,
} from "./utils.js";
import {
  resolveStageHistory,
  resolveStageHistoryDuration,
  stageHistoryDisplay,
} from "@retainpdf/domain/job";

export function buildStageHistoryPresentation(job, durationOptions = {}) {
  const history = resolveStageHistory(job);
  const markup = history.map((entry, index) => {
    const duration = resolveStageHistoryDuration(entry, job, durationOptions);
    const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
    const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isJobTerminal(job) ? "-" : "进行中");
    const stageDisplay = stageHistoryDisplay(entry);
    const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
    return `
      <article class="stage-history-item">
        <div class="stage-history-main">
          <span class="stage-history-index">${index + 1}</span>
          <div class="stage-history-copy">
            <div class="stage-history-title">${escapeHtml(stageDisplay.title)}</div>
            ${stageDisplay.stage && stageDisplay.stage !== stageDisplay.title ? `<div class="stage-history-stage">${escapeHtml(stageDisplay.stage)}</div>` : ""}
            <div class="stage-history-meta">${escapeHtml(enterAt)} → ${escapeHtml(exitAt)}${escapeHtml(terminalText)}</div>
          </div>
        </div>
        <div class="stage-history-duration">${escapeHtml(formatRuntimeDuration(duration))}</div>
      </article>
    `;
  }).join("");
  return {
    markup,
    emptyText: "暂无阶段记录",
    hasItems: history.length > 0,
  };
}
