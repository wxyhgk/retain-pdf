// dialog-store(createDialogStore) → hook đăng ký React. Tham chiếu state chỉ
// cập nhật khi open()/close(), truyền trực tiếp vào useSyncExternalStore (mô
// phỏng use-drawer-active.js của reader).

import { useSyncExternalStore } from "react";
import type { DialogState, DialogStore } from "./dialog-store.js";

export function useDialogState<T = any>(dialogStore: DialogStore<T>): DialogState<T> {
  return useSyncExternalStore(
    dialogStore.subscribe,
    dialogStore.getState,
    dialogStore.getState,
  );
}
