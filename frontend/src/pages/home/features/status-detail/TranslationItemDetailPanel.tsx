// Gỡ lỗi dịch: chi tiết Item + phát lại — viết lại JSX cho
// features/status-detail/translation-renderer.js#renderTranslationItemDetail/
// #renderTranslationReplay (nối markup) thành dạng cấu trúc. Hàm định dạng thuần
// (boolLabel/diagnosticsOf/normalizeRoutePath/routePathOf/pageNumberOf/
// finalStatusOf/fallbackToOf/degradationReasonOf) giữ import trực tiếp;
// renderField/renderTextBlock đổi thành hai component JSX InfoRow/TextBlock.

import { InfoRow, TextBlock } from "./TranslationInfoBlocks.jsx";
import { STATUS_DETAIL_DIALOG_IDS } from "./status-detail-dom-ids.js";
import {
  boolLabel,
  degradationReasonOf,
  diagnosticsOf,
  fallbackToOf,
  finalStatusOf,
  normalizeRoutePath,
  pageNumberOf,
  routePathOf,
} from "../../composition/external.js";

function ItemDetailBody({ payload }) {
  const item = payload.item || {};
  const diagnostics = diagnosticsOf(item);
  const routePath = normalizeRoutePath(routePathOf(item));
  const pageNumber = pageNumberOf(payload, pageNumberOf(item));
  const finalStatus = finalStatusOf(item) || finalStatusOf(payload) || "-";
  return (
    <>
      <div className="detail-info-list translation-detail-grid">
        <InfoRow label="item_id" value={payload.item_id || item.item_id || "-"} />
        <InfoRow label="page_number" value={pageNumber} />
        <InfoRow label="block_type" value={item.block_type || "-"} />
        <InfoRow label="math_mode" value={item.math_mode || "-"} />
        <InfoRow label="classification_label" value={item.classification_label || "-"} />
        <InfoRow label="should_translate" value={boolLabel(item.should_translate)} />
        <InfoRow label="skip_reason" value={item.skip_reason || "-"} />
        <InfoRow label="final_status" value={finalStatus} />
        <InfoRow label="route_path" value={routePath || "-"} />
        <InfoRow label="fallback_to" value={fallbackToOf(item) || "-"} />
        <InfoRow label="degradation_reason" value={degradationReasonOf(item) || "-"} />
      </div>
      <TextBlock label="Bản gốc" value={item.source_text || ""} />
      <TextBlock label="Bản dịch đã lưu" value={item.translated_text || item.translation_unit_translated_text || item.group_translated_text || ""} />
      <TextBlock label="Bản dịch sau bảo vệ" value={item.protected_translated_text || item.translation_unit_protected_translated_text || item.group_protected_translated_text || ""} />
      <TextBlock label="translation_diagnostics" value={diagnostics || {}} />
    </>
  );
}

function ReplayBody({ replay }) {
  const payload = replay.payload || {};
  return (
    <div className="translation-replay-grid">
      <TextBlock label="policy_before" value={payload.policy_before || {}} />
      <TextBlock label="policy_after" value={payload.policy_after || {}} />
      <TextBlock label="replay_result" value={payload.replay_result || {}} />
      <TextBlock label="replay_error" value={payload.replay_error || null} />
    </div>
  );
}

export function TranslationItemDetailPanel({ translation, onReplay }) {
  const payload = translation.selectedItem;
  const loading = translation.itemDetailLoading;
  const hasItem = Boolean(payload?.item);
  const emptyText = translation.itemErrorText
    || (translation.selectedItemId ? "Vui lòng chọn item bên trái" : "Không có item để xem");
  const meta = loading
    ? "Đang đọc..."
    : hasItem
      ? `${payload.item_id || payload.item?.item_id || "-"} · Trang ${pageNumberOf(payload, pageNumberOf(payload.item))}`
      : "-";
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  const replay = translation.replay;
  const hasReplayResult = Boolean(replay?.payload);
  const replayStatus = translation.replayLoading
    ? "Đang phát lại..."
    : hasReplayResult
      ? (replay.payload.replay_error ? "Phát lại trả về lỗi" : "Phát lại hoàn tất")
      : (translation.replayErrorText || "-");

  return (
    <section className="translation-debug-column translation-debug-column-detail">
      <div className="translation-debug-subhead"><h4>Chi tiết item</h4><span id={ids.itemMeta} className="status-panel-note">{meta}</span></div>
      <div className="translation-panel-body translation-panel-body-detail">
        <div id={ids.itemLoading} className={loading ? "events-empty" : "events-empty hidden"}>Đang đọc chi tiết item...</div>
        <div id={ids.itemEmpty} className={!loading && !hasItem ? "events-empty" : "events-empty hidden"}>{emptyText}</div>
        <div id={ids.itemDetail} className={!loading && hasItem ? "translation-item-detail" : "translation-item-detail hidden"}>
          {!loading && hasItem ? <ItemDetailBody payload={payload} /> : null}
        </div>
      </div>
      <div className="translation-replay-actions">
        <button id={ids.itemReplay} type="button" className="button-link secondary" disabled={!hasItem} onClick={onReplay}>Phát lại item hiện tại</button>
        <span id={ids.replayStatus} className="status-panel-note">{replayStatus}</span>
      </div>
      <div id={ids.replayResult} className={hasReplayResult ? "translation-replay-result" : "translation-replay-result hidden"}>
        {hasReplayResult ? <ReplayBody replay={replay} /> : null}
      </div>
    </section>
  );
}
