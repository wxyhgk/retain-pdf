// CollectionManageDialog Phiên bản trạng thái đóng(state/dialog-store.js Nhà máy tổng hợp,ảnh phản chiếu
// glossaries-dialog-store.js)。payload = Chỉnh sửa CollectionRecord,Hoặc null
// (Chế độ mới)——open(collection) Đầu vào được phân biệt với đầu vào mới/HIệu chỉnh,Không cần trả thêm tiền mode Trường。

import { createDialogStore } from "../../state/dialog-store.js";

export function createCollectionManageDialogStore() {
  return createDialogStore(null);
}
