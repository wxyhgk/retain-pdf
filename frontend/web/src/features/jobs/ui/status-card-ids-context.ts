// StatusCard 子树 DOM id 上下文。
// 主流程 StatusCard 用全局契约 id（smoke 依赖）；书籍详情等嵌入态用前缀 id，
// 避免与 #job-status-card / #status-stage-flow 等冲突。

import { createContext, useContext } from "react";
import { STATUS_CARD_ACTION_IDS, STATUS_CARD_IDS } from "./status-card-dom-ids.js";

export type StatusCardIds = typeof STATUS_CARD_IDS;
export type StatusCardActionIds = typeof STATUS_CARD_ACTION_IDS;

export const StatusCardIdsContext = createContext<StatusCardIds>(STATUS_CARD_IDS);

export function useStatusCardIds(): StatusCardIds {
  return useContext(StatusCardIdsContext) || STATUS_CARD_IDS;
}

export function createPrefixedStatusCardIds(prefix = "book-detail-"): StatusCardIds {
  const p = `${prefix || ""}`;
  const next = {} as Record<keyof StatusCardIds, string>;
  for (const [key, value] of Object.entries(STATUS_CARD_IDS) as Array<[keyof StatusCardIds, string]>) {
    next[key] = `${p}${value}`;
  }
  return Object.freeze(next) as StatusCardIds;
}

/**
 * 下载按钮 id 必须保持契约字符串（artifact-downloads 文档级委托按 id 命中）。
 * 嵌入态若也渲染 ResultActions，应继续用全局 DOWNLOAD ids，不要加前缀。
 */
export function createPrefixedStatusCardActionIds(prefix = "book-detail-"): StatusCardActionIds {
  const p = `${prefix || ""}`;
  return Object.freeze({
    pdf: `${p}${STATUS_CARD_ACTION_IDS.pdf}`,
    reader: `${p}${STATUS_CARD_ACTION_IDS.reader}`,
    sourcePdf: `${p}${STATUS_CARD_ACTION_IDS.sourcePdf}`,
    markdownBundle: `${p}${STATUS_CARD_ACTION_IDS.markdownBundle}`,
  }) as StatusCardActionIds;
}
