// GlossariesDialog Phiên bản trạng thái đóng(state/dialog-store.js Nhà máy tổng hợp,ảnh phản chiếu
// credentials-dialog-store.js)。payload Tên miền kênh chưa được sử dụng,Đặt phòng và Hợp đồng Chung
// Khớp,Thuận tiện cho tương lai"Mở bằng các tham số"(Ví dụ, từ developer Trực tiếp xác định vị trí một mục nhập trong danh sách thả xuống của bảng chú giải thuật ngữ)。

import { createDialogStore } from "../../state/dialog-store.js";

export function createGlossariesDialogStore() {
  return createDialogStore();
}
