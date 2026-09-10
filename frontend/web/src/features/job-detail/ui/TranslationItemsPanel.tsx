// 翻译调试:Item 列表 + 分页——JSX 重写
// features/status-detail/translation-renderer.js#renderTranslationItems 与
// status-detail-dialog-translation.js#renderTranslationItems 两段(markup 拼接
// + DOM 三态切换)的结构化版本;逐项断言取代 markup 断言(蓝图 §1.1)。
// 纯格式化函数(finalStatusOf/finalStatusLabel/finalStatusClass/previewText/
// pageNumberOf/errorTypesOf)保留直接 import。

import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";
import {
  errorTypesOf,
  finalStatusClass,
  finalStatusLabel,
  finalStatusOf,
  pageNumberOf,
  previewText,
} from "../domain/dialog/formatters.js";

function TranslationItemCard({ item, active, onSelect }) {
  const finalStatus = finalStatusOf(item);
  const errorTypes = errorTypesOf(item);
  const metaBits = [
    `第 ${pageNumberOf(item)} 页`,
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
    ? "读取中..."
    : `共 ${total} 条，本页 ${list.length} 条，offset ${offset}，limit ${limit}`;
  const pageLabel = loading
    ? "读取中..."
    : total > 0 ? `第 ${currentPage} / ${totalPages} 页` : "第 0 / 0 页";
  const canPrev = offset > 0;
  const canNext = offset + list.length < total;
  const hasItems = list.length > 0;
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  return (
    <section className="translation-debug-column translation-debug-column-list">
      <div className="translation-debug-subhead"><h4>Item 列表</h4><span id={ids.itemsMeta} className="status-panel-note">{meta}</span></div>
      <div className="translation-panel-body">
        <div id={ids.itemsLoading} className={loading ? "events-empty" : "events-empty hidden"}>正在读取翻译 item...</div>
        <div id={ids.itemsEmpty} className={!loading && !hasItems ? "events-empty" : "events-empty hidden"}>
          {translation.itemsErrorText || "没有匹配的翻译 item"}
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
        >上一页</button>
        <span id={ids.itemsPage} className="status-panel-note">{pageLabel}</span>
        <button
          id={ids.itemsNext}
          type="button"
          className="button-link secondary"
          disabled={loading || !canNext}
          onClick={() => onChangePage("next")}
        >下一页</button>
      </div>
    </section>
  );
}
