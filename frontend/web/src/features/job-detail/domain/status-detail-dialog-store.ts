// StatusDetailDialog 的开合状态实例(用 state/dialog-store.js 通用工厂,
// 蓝图 §1"新 store"清单第二项)。payload 携带 { activeTab },open(tabName)
// 与 activateTab(tabName) 都直接调用 dialogStore.open({ activeTab }) ——
// createDialogStore().open() 对已 open 的状态更新 payload，受控 AppDialog
// 会原位切换内容，所以"打开时指定 tab"与"打开后切 tab"可以复用同一个方法。

import { createDialogStore, type DialogStore } from "@/platform/store/dialog-store.js";

export type StatusDetailDialogPayload = {
  activeTab: string;
};

export type StatusDetailDialogStore = DialogStore<StatusDetailDialogPayload>;

export function createStatusDetailDialogStore(): StatusDetailDialogStore {
  return createDialogStore<StatusDetailDialogPayload>({ activeTab: "overview" });
}
