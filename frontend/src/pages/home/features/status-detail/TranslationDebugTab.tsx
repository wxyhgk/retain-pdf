// Tab gỡ lỗi dịch (chẩn đoán nâng cao) — tổ hợp Summary/FilterPanel/ItemsPanel/DetailPanel,
// viết lại JSX chuyển ba trạng thái hidden của lớp ngoài status/empty/content
// (nhánh hidden của status-detail-dialog-translation.js#renderTranslationSummary)
// (bảng thành phần bản thiết kế §1.2: họ TranslationDebugTab).

import { TranslationSummary } from "./TranslationSummary.jsx";
import { TranslationFilterPanel } from "./TranslationFilterPanel.jsx";
import { TranslationItemsPanel } from "./TranslationItemsPanel.jsx";
import { TranslationItemDetailPanel } from "./TranslationItemDetailPanel.jsx";
import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";

export function TranslationDebugTab({ translation, controller }) {
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;
  const hidden = Boolean(translation.emptyMessage);

  return (
    <section className="status-panel translation-debug-panel">
      <div className="status-panel-head">
        <h3>Gỡ lỗi dịch</h3>
        <span id={ids.debugStatus} className="status-panel-note">
          {hidden ? "Không có dữ liệu gỡ lỗi dịch" : "Xem từng item để tìm hiểu lý do không dịch hoặc giữ nguyên bản gốc"}
        </span>
      </div>
      <div id={ids.debugEmpty} className={hidden ? "events-empty" : "events-empty hidden"}>
        {translation.emptyMessage || "Chưa có dữ liệu gỡ lỗi dịch"}
      </div>
      <div id={ids.debugContent} className={hidden ? "translation-debug-content hidden" : "translation-debug-content"}>
        <TranslationSummary translation={translation} />
        <TranslationFilterPanel query={translation.query} onApply={controller.applyTranslationFilter} />
        <div className="translation-debug-layout">
          <TranslationItemsPanel
            translation={translation}
            onSelect={controller.selectTranslationItem}
            onChangePage={controller.changeTranslationPage}
          />
          <TranslationItemDetailPanel translation={translation} onReplay={controller.replayCurrentItem} />
        </div>
      </div>
    </section>
  );
}
