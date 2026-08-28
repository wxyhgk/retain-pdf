// Gỡ lỗi dịch: danh sách Item + phân trang — viết lại JSX cho hai đoạn
// features/status-detail/translation-renderer.js#renderTranslationItems và
// status-detail-dialog-translation.js#renderTranslationItems (nối markup +
// chuyển ba trạng thái DOM) thành dạng cấu trúc; assert từng mục thay thế assert
// markup (bản thiết kế §1.1). Hàm định dạng thuần (finalStatusOf/finalStatusLabel/
// finalStatusClass/previewText/pageNumberOf/errorTypesOf) giữ import trực tiếp.

import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";
import {
  errorTypesOf,
  finalStatusClass,
  finalStatusLabel,
  finalStatusOf,
  pageNumberOf,
  previewText,
} from "../../composition/external.js";

function TranslationItemCard({ item, active, onSelect }) {
  const finalStatus = finalStatusOf(item);
  const errorTypes = errorTypesOf(item);
  const metaBits = [
    `Trang ${pageNumberOf(item)}`,
    item.block_type || "",
    item.classification_label || "",
  ].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      className={`translation-item-card${active ? " is-active" : ""}`}
      data-translation-item-id={item.item_id}
      onClick={() => onSelect(item.item_id)}
    >
      <div className="translation-item-card-top">
        <span className="translation-item-id mono">{item.item_id || "-"}</span>
        <span className={`translation-item-status ${finalStatusClass(finalStatus)}`}>{finalStatusLabel(finalStatus)}</span>
      </div>
      <div className="translation-item-card-preview">{previewText(item.source_preview || item.source_text || "")}</div>
      <div className="translation-item-card-meta">
        {metaBits}
        {errorTypes.length ? <span className="translation-item-error">{` · ${errorTypes.join(", ")}`}</span> : null}
      </div>
    </button>
  );
}

export function TranslationItemsPanel({ translation, onSelect, onChangePage }) {
  const list = translation.list || [];
  const offset = Number(translation.query.offset || 0);
  const limit = Number(translation.query.limit || 20);
  const total = Number(translation.total || 0);
  const loading = translation.itemsLoading;
  const totalPages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 0;
  const currentPage = total > 0 ? Math.floor(offset / Math.max(limit, 1)) + 1 : 0;
  const meta = loading
    ? "Đang đọc..."
    : `Tổng ${total} mục, trang này ${list.length} mục, offset ${offset}, limit ${limit}`;
  const pageLabel = loading
    ? "Đang đọc..."
    : total > 0 ? `Trang ${currentPage} / ${totalPages}` : "Trang 0 / 0";
  const canPrev = offset > 0;
  const canNext = offset + list.length < total;
  const hasItems = list.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  return (
    <section className="translation-debug-column translation-debug-column-list">
      <div className="translation-debug-subhead"><h4>Danh sách item</h4><span id={ids.itemsMeta} className="status-panel-note">{meta}</span></div>
      <div className="translation-panel-body">
        <div id={ids.itemsLoading} className={loading ? "events-empty" : "events-empty hidden"}>Đang đọc item bản dịch...</div>
        <div id={ids.itemsEmpty} className={!loading && !hasItems ? "events-empty" : "events-empty hidden"}>
          {translation.itemsErrorText || "Không có item bản dịch phù hợp"}
        </div>
        <div id={ids.itemsList} className={!loading && hasItems ? "translation-items-list" : "translation-items-list hidden"}>
          {list.map((item) => (
            <TranslationItemCard
              key={item.item_id}
              item={item}
              active={item.item_id === translation.selectedItemId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
      <div className="translation-items-pagination">
        <button
          id={ids.itemsPrev}
          type="button"
          className="button-link secondary"
          disabled={loading || !canPrev}
          onClick={() => onChangePage("prev")}
        >Trang trước</button>
        <span id={ids.itemsPage} className="status-panel-note">{pageLabel}</span>
        <button
          id={ids.itemsNext}
          type="button"
          className="button-link secondary"
          disabled={loading || !canNext}
          onClick={() => onChangePage("next")}
        >Trang sau</button>
      </div>
    </section>
  );
}
