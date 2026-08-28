// Trạng thái mở và đóng của cửa sổ bật lên thông tin đặt phòng(Tham khảo PDF_MD_lib của BookDetailModal)。
// payload = Tấm lưới đã được nhấp vào item(hàm document_id / job_id / status /
// library_only / reading_status / tags Chờ trường tức thì),Nhấn một lần nữa trong cửa sổ bật lên document_id Kéo một lần
// Tác giả hoàn thành tài liệu đầy đủ/niên đại/DOI/bai/Ngày Siêu dữ liệu không khả dụng trên các thẻ này。
//
// Multiplex Chung createDialogStore({ open, payload })——cùng CollectionManageDialog。

import { createDialogStore } from "../../../state/dialog-store.js";
import type { LibraryCardItem } from "../types.js";

export function createBookDetailDialogStore() {
  return createDialogStore<LibraryCardItem | null>(null);
}
