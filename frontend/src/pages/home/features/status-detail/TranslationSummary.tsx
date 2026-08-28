// Gỡ lỗi dịch: thẻ đếm + gợi ý bộ lọc hiện tại — viết lại JSX cho logic ghi DOM
// của status-detail-dialog-translation.js#renderTranslationSummary (finalStatusCounts
// ưu tiên counts, khớp thế giới cũ); summarizeTranslationFilter là hàm định dạng thuần,
// giữ import trực tiếp.

import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";
import { summarizeTranslationFilter } from "../../composition/external.js";

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
        <div className="translation-summary-card"><span className="label">Đã dịch</span><span id={ids.countTranslated} className="info-value">{counts.translated ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">Dịch một phần</span><span id={ids.countPartiallyTranslated} className="info-value">{counts.partially_translated ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">Giữ bản gốc</span><span id={ids.countKeptOrigin} className="info-value">{counts.kept_origin ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">Thất bại</span><span id={ids.countFailed} className="info-value">{counts.failed ?? 0}</span></div>
        <div className="translation-summary-card"><span className="label">Provider</span><span id={ids.providerFamily} className="info-value">{providerFamily}</span></div>
      </div>
      <div className="translation-summary-notes">
        <span id={ids.listFilter} className="status-panel-note">{`Bộ lọc danh sách hiện tại: ${filterText}`}</span>
      </div>
    </section>
  );
}
