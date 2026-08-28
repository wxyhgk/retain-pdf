// Thực thể trạng thái đóng/mở của SettingsHubDialog (nhà máy chung state/dialog-store.js).
// payload mang "tab nào kích hoạt khi mở" (api/glossary/update), mặc định "api".

import { createDialogStore } from "../../state/dialog-store.js";

export function createSettingsHubDialogStore() {
  return createDialogStore({ tab: "api" });
}
