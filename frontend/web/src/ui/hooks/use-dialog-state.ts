// dialog-store(createDialogStore)→ React 订阅 hook。state 对象引用只在
// open()/close() 时更新,直接喂 useSyncExternalStore(镜像 reader 的
// use-drawer-active.js)。

import { useSyncExternalStore } from "react";
import type { DialogState, DialogStore } from "@/platform/store/dialog-store.js";

export function useDialogState<T = any>(dialogStore: DialogStore<T>): DialogState<T> {
  return useSyncExternalStore(
    dialogStore.subscribe,
    dialogStore.getState,
    dialogStore.getState,
  );
}
