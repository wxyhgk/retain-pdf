// CredentialsDialog phiên bản trạng thái đóng (dùng factory state/dialog-store.js).
// payload hiện không được sử dụng (setupMode chuyển sang credentials-view-store, các trường tách biệt,
// vì nó sẽ kích hoạt render lại tiêu đề/nút Lưu dưới dạng copywriting, không chỉ riêng "đóng/mở");
// giữ đoạn payload để duy trì tính nhất quán hợp đồng chung với dialog-store.js,
// khi cần "mở bằng tham số" trong tương lai có thể dùng trực tiếp mà không phải sửa lại factory.

import { createDialogStore } from "../../state/dialog-store.js";

export function createCredentialsDialogStore() {
  return createDialogStore();
}
