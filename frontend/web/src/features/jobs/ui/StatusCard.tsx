// StatusCard 入口。
//
// 只剩一套展示：StatusCardEmbedded —— 书籍详情的 #book-detail-job-status-card
// （bd-job-status-* 固定高度）。useStatusCardModel 提供共享的
// store → display / lottie / progress。
//
// 曾经还有一套 StatusCardMain（主页那张页面级卡 #job-status-card，带一批不加
// 前缀的 DOM 契约 id 和隐藏区 job-id/job-status/job-stage-detail/
// query-job-duration/job-finished-at）。进度主场收敛到书籍详情的「进度」Tab 之后
// 它零渲染点，连同那批契约一并下线：那些 id 没有任何代码从 DOM 读（setText 写的
// 是 text-store，不碰 DOM），纯属遗留压舱物。它承载的两样能力已各自安家——
// 结果操作行搬进了详情处理卡（ProcessingResultActions，契约 id 原样保留，
// artifacts 域的 document 级委托据此拦截点击），任务详情入口走
// statusDetail.controller.openStatusDetailDialog()。

import { StatusCardEmbedded, type StatusCardEmbeddedProps } from "./StatusCardEmbedded.jsx";

/**
 * @param {object} props
 * @param {boolean} [props.visible]
 * @param {string} [props.idPrefix]
 * @param {string} [props.rootId]
 * @param {string} [props.className]
 * @param {object} [props.fallbackItem]
 */
export function StatusCard({
  visible = true,
  idPrefix = "book-detail-",
  rootId,
  className = "",
  fallbackItem = null,
}: StatusCardEmbeddedProps) {
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

export { StatusCardEmbedded } from "./StatusCardEmbedded.jsx";
export { useStatusCardModel } from "./use-status-card-model.js";
export { mergeSnapshotWithFallback, isPollingBootstrapPlaceholder } from "../domain/merge-snapshot-with-fallback.js";
