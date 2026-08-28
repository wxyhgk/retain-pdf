// Lối vào StatusCard: hai chế độ hiển thị quy trình chính / chi tiết sách được
// tách thành các tệp riêng.
//
// - StatusCardMain: popup quy trình #job-status-card (hợp đồng DOM / smoke)
// - StatusCardEmbedded: chi tiết #book-detail-job-status-card (chiều cao cố định bd-job-status-*)
// - useStatusCardModel: store dùng chung → display / lottie / progress

import { StatusCardMain } from "./StatusCardMain.jsx";
import { StatusCardEmbedded } from "./StatusCardEmbedded.jsx";

/**
 * @param {object} props
 * @param {boolean} [props.visible]
 * @param {boolean} [props.embedded]
 * @param {string} [props.idPrefix]
 * @param {boolean} [props.showResultActions]
 * @param {boolean} [props.showHiddenContract]
 * @param {string} [props.rootId]
 * @param {string} [props.className]
 * @param {object} [props.fallbackItem]
 */
export function StatusCard({
  visible = true,
  embedded = false,
  idPrefix = "book-detail-",
  showResultActions,
  showHiddenContract,
  rootId,
  className = "",
  fallbackItem = null,
}) {
  if (embedded) {
    return (
      <StatusCardEmbedded
        visible={visible}
        idPrefix={idPrefix}
        rootId={rootId || `${idPrefix}job-status-card`}
        className={className}
        fallbackItem={fallbackItem}
      />
    );
  }

  return (
    <StatusCardMain
      visible={visible}
      showResultActions={showResultActions ?? true}
      showHiddenContract={showHiddenContract ?? true}
      className={className}
    />
  );
}

export { StatusCardMain } from "./StatusCardMain.jsx";
export { StatusCardEmbedded } from "./StatusCardEmbedded.jsx";
export { useStatusCardModel } from "./use-status-card-model.js";
export { mergeSnapshotWithFallback, isPollingBootstrapPlaceholder } from "./merge-snapshot-with-fallback.js";
