// 翻译调试:计数卡片 + 当前筛选提示——JSX 重写
// status-detail-dialog-translation.js#renderTranslationSummary 的 DOM 写入
// 逻辑(finalStatusCounts 优先于 counts,和旧世界一致);summarizeTranslationFilter
// 是纯格式化函数,保留直接 import。

import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";
import {
  summarizeTranslationFilter,
} from "../domain/dialog/formatters.js";

export function TranslationSummary({ translation }) {
  const summary = translation.summary?.summary || {};
  const finalStatusCounts = summary.status_summary || summary.final_status_counts || {};
  const counts = Object.keys(finalStatusCounts || {}).length ? finalStatusCounts : (summary.counts || {});
  const providerFamily = `${summary.provider_family || summary.provider || ""}`.trim() || "-";
  const filterText = summarizeTranslationFilter(translation.query);
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  return (
    <section className="translation-summary-shell">
      <div className="translation-summary-grid">
        <div className="translation-summary-card"><span className="label">已翻译</span><span id={ids.countTranslated} className="info-value">{counts.translated ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">部分翻译</span><span id={ids.countPartiallyTranslated} className="info-value">{counts.partially_translated ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">保留原文</span><span id={ids.countKeptOrigin} className="info-value">{counts.kept_origin ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">失败</span><span id={ids.countFailed} className="info-value">{counts.failed ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">Provider</span><span id={ids.providerFamily} className="info-value">{providerFamily}</span></div>
      </div>
      <div className="translation-summary-notes">
        <span id={ids.listFilter} className="status-panel-note">{`当前列表筛选：${filterText}`}</span>
      </div>
    </section>
  );
}
