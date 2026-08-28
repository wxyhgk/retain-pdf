// Thực thể trạng thái đóng/mở của StatusDetailDialog (dùng nhà máy chung state/dialog-store.js,
// mục thứ hai trong danh sách "store mới" của bản thiết kế §1). payload mang theo { activeTab },
// open(tabName) và activateTab(tabName) đều gọi thẳng dialogStore.open({ activeTab }) —
// createDialogStore().open() đối với trạng thái đã open chỉ gộp payload, không kích hoạt
// showModal lặp lại (effect của StatusDetailDialog.jsx chỉ gọi showModal khi open đi từ
// false→true), nên "chỉ định tab khi mở" với "đổi tab sau khi mở" có thể dùng chung một
// phương thức.

import { createDialogStore, type DialogStore } from "../../state/dialog-store.js";

export type StatusDetailDialogPayload = {
  activeTab: string;
};

export type StatusDetailDialogStore = DialogStore<StatusDetailDialogPayload>;

export function createStatusDetailDialogStore(): StatusDetailDialogStore {
  return createDialogStore<StatusDetailDialogPayload>({ activeTab: "overview" });
}
