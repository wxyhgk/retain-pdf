// StatusCard 入口：主流程 / 书籍详情两套展示拆成独立文件。
//
// - StatusCardMain：工作流弹窗 #job-status-card（DOM 契约 / smoke）
// - StatusCardEmbedded：详情 #book-detail-job-status-card（bd-job-status-* 固定高度）
// - useStatusCardModel：共享 store → display / lottie / progress

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
export { mergeSnapshotWithFallback, isPollingBootstrapPlaceholder } from "../domain/merge-snapshot-with-fallback.js";
