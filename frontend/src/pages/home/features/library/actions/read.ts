// BookCard「Đọc nhanh」Hành động —— Mô-đun độc lập，Thay đổi logic đọc để chỉ di chuyển tài liệu này。
//
// hành vi:
// - Đã hoàn thành job → Đọc độ tương phản (onReader(jobId))
// - Nếu không, có document → Đọc bản gốc (onReadSource(documentId))
// - Không thành công và không có document → Vẫn quay lại nút，điểm kích no-op（Tương thích với di sản UI/khảo sát）

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export const BOOK_CARD_ACTION_READ = "read";

/**
 * @param item Tủ sách item
 * @param handlers onReader / onReadSource
 * @returns 0 Hoặc 1 chiếc action（Luôn luôn hiện tại 1 chiếc）
 */
export function buildReadBookCardAction(
  item: LibraryCardItem = {},
  { onReader, onReadSource }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const readerAvailable = `${item.status || ""}`.trim() === "succeeded";

  let label = "Đọc bản gốc";
  let onClick: BookCardAction["onClick"] = () => {};

  if (readerAvailable && jobId) {
    label = "Đọc đối chiếu";
    onClick = () => {
      onReader?.(jobId);
    };
  } else if (documentId) {
    label = "Đọc bản gốc";
    onClick = () => {
      onReadSource?.(documentId);
    };
  }

  return [{
    id: BOOK_CARD_ACTION_READ,
    label,
    icon: "eye",
    // Neo kiểm tra lịch sử .recent-job-reader
    className: "book-card-action book-card-action-read recent-job-reader",
    onClick,
  }];
}
