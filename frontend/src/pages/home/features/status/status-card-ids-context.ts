// Ngữ cảnh id DOM của cây con StatusCard.
// StatusCard luồng chính dùng id hợp đồng toàn cục (smoke phụ thuộc); trạng thái nhúng như
// chi tiết sách dùng id có tiền tố, tránh xung đột với #job-status-card / #status-stage-flow v.v.

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
 * Id nút tải xuống phải giữ chuỗi hợp đồng (ủy thác cấp tài liệu artifact-downloads theo id).
 * Trạng thái nhúng nếu cũng render ResultActions, nên tiếp tục dùng id DOWNLOAD toàn cục,
 * không thêm tiền tố.
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
