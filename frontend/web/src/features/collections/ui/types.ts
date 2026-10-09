// CollectionsView 的对外依赖契约：与视图渲染分离，子组件只依赖这里，
// 避免通过主文件回引形成耦合。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type { CollectionRecord } from "../domain/controller.js";

/** 版本信号的快照：只有一个 version 字段，每次保存/删除后 bump。 */
export type CollectionsReloadSnapshot = { version: number };

/** 由页面注入：合集域的三件依赖 + 图书馆的跳转动作。 */
export type CollectionsController = ReturnType<
  typeof import("../domain/controller.js").createCollectionsController
>;

// TODO(feature-layout 批次 5): dialog-store / use-dialog-state 是通用状态工具，
// 随批次 5 迁入 platform 后改指。
export type CollectionsDialogStore = DialogStore<CollectionRecord | null>;

export type CollectionsReloadSignal = {
  actions: Record<string, (...args: unknown[]) => unknown>;
  getSnapshot: () => CollectionsReloadSnapshot;
  subscribe: (listener: (snapshot: CollectionsReloadSnapshot) => void) => () => void;
};

export type CollectionsLibraryActions = {
  openBookDetail: (...args: unknown[]) => unknown;
  openJobReader: (...args: unknown[]) => unknown;
  openSourceReader: (...args: unknown[]) => unknown;
  selectJob: (...args: unknown[]) => unknown;
};

export type CollectionsViewProps = {
  controller: CollectionsController;
  dialogStore: CollectionsDialogStore;
  reloadSignal: CollectionsReloadSignal;
  libraryActions: CollectionsLibraryActions;
};
