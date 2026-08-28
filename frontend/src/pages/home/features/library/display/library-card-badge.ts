// Huy hiệu trạng thái cuối ở góc trên bên phải thẻ thư viện.
// Khi đang chạy (xếp hàng/OCR/dịch/render), không ghi chữ vào huy hiệu (dễ bị
// cắt); dùng hoạt ảnh tải ở giữa bìa để biểu thị.

import type { LibraryCardBadge, LibraryCardItem } from "../types.js";
import {
  isRecentJobActive,
  stageKeyForRecentJobLabel,
  isLibraryOnlyItem,
} from "../../../composition/external.js";

/**
 * @returns Huy hiệu trạng thái cuối/lưu trữ; khi đang chạy trả về null (thay bằng loading giữa bìa).
 */
export function libraryCardBadge(item: LibraryCardItem = {}): LibraryCardBadge | null {
  if (isLibraryOnlyItem(item)) {
    return {
      label: "Lưu trữ",
      icon: "archive",
      cls: "border border-border bg-white/95 text-muted-foreground",
    };
  }

  const status = `${item.status || ""}`.trim().toLowerCase();
  const stageKey = stageKeyForRecentJobLabel(item);

  if (status === "failed" || stageKey === "failed") {
    return {
      label: "Thất bại",
      icon: "alert",
      cls: "bg-destructive/12 text-destructive",
    };
  }
  if (status === "canceled" || status === "cancelled" || stageKey === "canceled") {
    return {
      label: "Đã hủy",
      icon: "clock",
      cls: "bg-muted text-muted-foreground",
    };
  }

  // Đang chạy (kể cả thử lại): không có huy hiệu, loading ở giữa bìa.
  if (isLibraryCardProcessing(item)) {
    return null;
  }

  // Đã hoàn thành
  if (status === "succeeded" || stageKey === "done") {
    return {
      label: "Đã dịch",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  // Xếp hàng / đang chạy (dự phòng)
  if (isRecentJobActive(item) || status === "queued" || status === "running") {
    return null;
  }

  // Dự phòng: có giai đoạn done
  if (stageKey === "done") {
    return {
      label: "Đã dịch",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  return null;
}

/** Có nên hiển thị hoạt ảnh loading khi đang xử lý ở giữa bìa không */
export function isLibraryCardProcessing(item: LibraryCardItem = {}): boolean {
  if (isLibraryOnlyItem(item)) return false;
  const status = `${item.status || ""}`.trim().toLowerCase();
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return false;
  }
  // Đang chạy rõ ràng
  if (status === "queued" || status === "running" || status === "pending") {
    return true;
  }
  // Sau khi thử lại, status đôi khi chưa kịp đổi nhưng stage đã quay về ocr/dịch/render
  const stage = stageKeyForRecentJobLabel(item);
  if (["ocr", "translate", "render", "queued"].includes(stage)) {
    // succeeded + stage=done là hoàn thành thật; succeeded + stage=ocr là trạng thái bẩn
    // sau thử lại → vẫn quay.
    if (status === "succeeded" && stage === "done") return false;
    if (status === "succeeded" || status === "") return true;
  }
  if (status === "succeeded" || stage === "done") return false;
  return isRecentJobActive(item);
}
